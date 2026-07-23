import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Video from 'react-native-video';
import * as FileSystem from 'expo-file-system';
import { getAuthHeaders } from '../services/api';
import { CONFIG, COLORS } from '../utils/constants';
import { formatTime } from '../utils/helpers';

const { width, height } = Dimensions.get('window');

const HEADERS_CDN = {
  Origin: 'https://novelasflix.video',
  Referer: 'https://novelasflix.video/',
  'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36',
  Accept: '*/*',
};

// Headers específicos para o Rei dos Canais
const HEADERS_LIVE = {
  Referer: 'https://reidoscanais.st/',
  'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36',
};

function nomeSeguro(valor) {
  return String(valor || 'video').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80);
}

function urlAbsoluta(uri, base) {
  if (!uri || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(uri)) return uri;
  try {
    return new URL(uri, base).toString();
  } catch (causa) {
    const origem = String(base || '').replace(/[?#].*$/, '');
    const raiz = origem.replace(/\/[^/]*$/, '/');
    if (uri.startsWith('/')) {
      const correspondencia = origem.match(/^(https?:\/\/[^/]+)/i);
      return `${correspondencia?.[1] || ''}${uri}`;
    }
    return `${raiz}${uri}`;
  }
}

function reescreverManifestoHls(manifesto, base) {
  return String(manifesto)
    .split(/\r?\n/)
    .map((linha) => {
      const limpa = linha.trim();
      if (!limpa) return linha;
      if (!limpa.startsWith('#')) return urlAbsoluta(limpa, base);
      return linha.replace(/URI=(['"])(.*?)\1/g, (trecho, aspas, uri) => (
        `URI=${aspas}${urlAbsoluta(uri, base)}${aspas}`
      ));
    })
    .join('\n');
}

export default function PlayerScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { 
    categoria, 
    slug, 
    tipo = 'filme', 
    titulo = 'TEDFLIX'
  } = route.params || {};

  const [manifestUri, setManifestUri] = useState(null);
  const [preparando, setPreparando] = useState(true);
  const [pronto, setPronto] = useState(false);
  const [bufferizando, setBufferizando] = useState(false);
  const [erro, setErro] = useState('');
  const [tentativa, setTentativa] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [mostrarControles, setMostrarControles] = useState(true);
  const [duracao, setDuracao] = useState(0);
  const [tempoAtual, setTempoAtual] = useState(0);
  const [larguraProgresso, setLarguraProgresso] = useState(0);
  const [larguraVolume, setLarguraVolume] = useState(0);
  const [volume, setVolume] = useState(1);
  const [mudo, setMudo] = useState(false);
  const [telaCheia, setTelaCheia] = useState(false);

  const videoRef = useRef(null);
  const esconderControlesRef = useRef(null);
  const arquivoManifestoRef = useRef(null);
  const requisicaoRef = useRef(0);

  const endpoint = useMemo(() => (
    tipo === 'episodio'
      ? `${CONFIG.STREAM_API}/episodio/${categoria}/${slug}`
      : `${CONFIG.STREAM_API}/filme-player/${categoria}/${slug}`
  ), [categoria, slug, tipo]);

  const limparManifestoLocal = useCallback(async () => {
    const arquivo = arquivoManifestoRef.current;
    arquivoManifestoRef.current = null;
    if (!arquivo) return;
    try {
      await FileSystem.deleteAsync(arquivo, { idempotent: true });
    } catch (causa) {
      console.warn('Não foi possível limpar o manifesto temporário:', causa);
    }
  }, []);

  const prepararManifesto = useCallback(async () => {
    const identificador = requisicaoRef.current + 1;
    requisicaoRef.current = identificador;

    setPreparando(true);
    setPronto(false);
    setBufferizando(false);
    setErro('');
    setManifestUri(null);
    setDuracao(0);
    setTempoAtual(0);

    await limparManifestoLocal();

    

    if (!categoria || !slug) {
      setPreparando(false);
      setErro('Dados incompletos. Volte e tente novamente.');
      return;
    }

    try {
      const authHeaders = await getAuthHeaders();
      const resposta = await fetch(endpoint, { headers: authHeaders });
      if (!resposta.ok) throw new Error(`Resposta ${resposta.status}`);

      const manifesto = await resposta.text();
      if (!manifesto.trim() || !manifesto.includes('#EXTM3U')) {
        throw new Error('Manifesto HLS inválido.');
      }

      const diretorioCache = FileSystem.cacheDirectory;
      const caminhoLocal = `${diretorioCache}tedflix-${nomeSeguro(categoria)}-${nomeSeguro(slug)}-${Date.now()}.m3u8`;
      const manifestoReescrito = reescreverManifestoHls(manifesto, resposta.url || endpoint);
      await FileSystem.writeAsStringAsync(caminhoLocal, manifestoReescrito, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (identificador !== requisicaoRef.current) {
        await FileSystem.deleteAsync(caminhoLocal, { idempotent: true });
        return;
      }

      arquivoManifestoRef.current = caminhoLocal;
      setManifestUri(caminhoLocal);
    } catch (causa) {
      if (identificador !== requisicaoRef.current) return;
      setErro('Não foi possível carregar o vídeo. Verifique sua conexão.');
      setPreparando(false);
    }
  }, [categoria, endpoint, embeds, isLive, limparManifestoLocal, slug]);

  useEffect(() => {
    prepararManifesto();
    return () => {
      requisicaoRef.current += 1;
      clearTimeout(esconderControlesRef.current);
      limparManifestoLocal();
    };
  }, [prepararManifesto, limparManifestoLocal, tentativa]);

  useEffect(() => {
    clearTimeout(esconderControlesRef.current);
    if (pronto && !pausado && mostrarControles && !erro) {
      esconderControlesRef.current = setTimeout(() => setMostrarControles(false), 4300);
    }
    return () => clearTimeout(esconderControlesRef.current);
  }, [erro, pronto, pausado, mostrarControles]);

  const revelarControles = () => {
    setMostrarControles(true);
    clearTimeout(esconderControlesRef.current);
    if (pronto && !pausado && !erro) {
      esconderControlesRef.current = setTimeout(() => setMostrarControles(false), 4300);
    }
  };

  const alternarControles = () => {
    mostrarControles ? setMostrarControles(false) : revelarControles();
  };

  const alternarPausa = () => {
    setPausado((atual) => !atual);
    revelarControles();
  };

  const avancar = (segundos) => {
    if (!duracao) return;
    const proximoTempo = Math.max(0, Math.min(duracao, tempoAtual + segundos));
    videoRef.current?.seek(proximoTempo);
    setTempoAtual(proximoTempo);
    revelarControles();
  };

  const buscarTempo = (posicaoX) => {
    if (!duracao || !larguraProgresso) return;
    const proporcao = Math.max(0, Math.min(1, posicaoX / larguraProgresso));
    const proximoTempo = proporcao * duracao;
    videoRef.current?.seek(proximoTempo);
    setTempoAtual(proximoTempo);
    revelarControles();
  };

  const ajustarVolume = (posicaoX) => {
    if (!larguraVolume) return;
    const proximoVolume = Math.max(0, Math.min(1, posicaoX / larguraVolume));
    setVolume(proximoVolume);
    setMudo(proximoVolume === 0);
    revelarControles();
  };

  const voltar = () => {
    if (telaCheia) {
      setTelaCheia(false);
      return;
    }
    navigation.goBack();
  };

  const porcentagemProgresso = duracao > 0 ? Math.min(100, (tempoAtual / duracao) * 100) : 0;
  const iconeVolume = mudo || volume === 0 ? 'volume-mute' : volume < 0.5 ? 'volume-medium' : 'volume-high';

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {manifestUri ? (
        <Video
          key={`${manifestUri}-${tentativa}`}
          ref={videoRef}
          source={{
            uri: manifestUri,
            type: 'm3u8',
            headers: HEADERS_CDN,
          }}
          style={styles.video}
          paused={pausado}
          muted={mudo}
          volume={volume}
          resizeMode="contain"
          fullscreen={telaCheia}
          onLoadStart={() => {
            setPreparando(true);
            setBufferizando(true);
          }}
          onLoad={(dados) => {
            setDuracao(dados?.duration || 0);
            setPreparando(false);
            setBufferizando(false);
            setPronto(true);
            revelarControles();
          }}
          onProgress={(dados) => setTempoAtual(dados?.currentTime || 0)}
          onBuffer={({ isBuffering }) => setBufferizando(Boolean(isBuffering))}
          onError={(dados) => {
            console.error('Erro no player:', dados);
            setErro('Erro ao reproduzir. Tente outro servidor ou canal.');
            setPreparando(false);
          }}
        />
      ) : null}

      <Pressable style={StyleSheet.absoluteFill} onPress={alternarControles} />

      {mostrarControles && !erro ? (
        <View style={styles.controles} pointerEvents="box-none">
          <View style={styles.gradienteTopo} />
          <View style={styles.gradienteInferior} />

          <View style={styles.barraTopo}>
            <TouchableOpacity style={styles.botaoTopo} onPress={voltar}>
              <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.titulo} numberOfLines={1}>{titulo}</Text>
            <TouchableOpacity style={styles.botaoTopo} onPress={() => setTelaCheia(!telaCheia)}>
              <MaterialCommunityIcons name={telaCheia ? 'fullscreen-exit' : 'fullscreen'} size={23} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {!preparando && !bufferizando && pronto && (
            <View style={styles.controlesCentrais}>
              <TouchableOpacity style={styles.botaoPular} onPress={() => avancar(-10)}>
                <MaterialCommunityIcons name="rewind-10" size={34} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.botaoPlay} onPress={alternarPausa}>
                <MaterialCommunityIcons name={pausado ? 'play' : 'pause'} size={37} color="#000000" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.botaoPular} onPress={() => avancar(10)}>
                <MaterialCommunityIcons name="fast-forward-10" size={34} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}

          {!preparando && pronto && (
            <View style={styles.barraInferior}>
              <View style={styles.areaProgresso} onLayout={(e) => setLarguraProgresso(e.nativeEvent.layout.width)}>
                <TouchableWithoutFeedback onPress={(e) => buscarTempo(e.nativeEvent.locationX)}>
                  <View style={styles.toqueProgresso}>
                    <View style={styles.trilhaProgresso}>
                      <View style={[styles.progressoPreenchido, { width: `${porcentagemProgresso}%` }]} />
                    </View>
                  </View>
                </TouchableWithoutFeedback>
              </View>

              <View style={styles.linhaFerramentas}>
                <TouchableOpacity style={styles.botaoFerramenta} onPress={alternarPausa}>
                  <MaterialCommunityIcons name={pausado ? 'play' : 'pause'} size={21} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.tempo}>{formatTime(tempoAtual)} / {formatTime(duracao)}</Text>
                
                <View style={styles.volumeWrap}>
                  <TouchableOpacity style={styles.botaoFerramenta} onPress={() => setMudo(!mudo)}>
                    <MaterialCommunityIcons name={iconeVolume} size={21} color="#FFFFFF" />
                  </TouchableOpacity>
                  <View style={styles.areaVolume} onLayout={(e) => setLarguraVolume(e.nativeEvent.layout.width)}>
                    <TouchableWithoutFeedback onPress={(e) => ajustarVolume(e.nativeEvent.locationX)}>
                      <View style={styles.toqueVolume}>
                        <View style={styles.trilhaVolume}>
                          <View style={[styles.volumePreenchido, { width: `${mudo ? 0 : volume * 100}%` }]} />
                        </View>
                      </View>
                    </TouchableWithoutFeedback>
                  </View>
                </View>
              </View>
            </View>
          )}
        </View>
      ) : null}

      {(preparando || bufferizando) && !erro && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.textoOverlay}>{preparando ? 'Preparando sinal...' : 'Carregando...'}</Text>
        </View>
      )}

      {erro ? (
        <View style={styles.overlay}>
          <MaterialCommunityIcons name="alert-circle-outline" size={50} color={COLORS.primary} />
          <Text style={styles.textoErro}>{erro}</Text>
          <TouchableOpacity style={styles.botaoErro} onPress={() => setTentativa(tentativa + 1)}>
            <Text style={styles.textoBotaoErro}>TENTAR NOVAMENTE</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.botaoVoltarErro} onPress={voltar}>
            <Text style={styles.textoBotaoVoltar}>VOLTAR</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  video: { width: '100%', height: '100%' },
  controles: { ...StyleSheet.absoluteFillObject, zIndex: 10 },
  gradienteTopo: { position: 'absolute', top: 0, width: '100%', height: 100, backgroundColor: 'rgba(0,0,0,0.6)' },
  gradienteInferior: { position: 'absolute', bottom: 0, width: '100%', height: 120, backgroundColor: 'rgba(0,0,0,0.6)' },
  barraTopo: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, height: 60 },
  botaoTopo: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  titulo: { flex: 1, color: '#fff', fontSize: 16, fontWeight: 'bold', marginHorizontal: 10 },
  badgeLive: { backgroundColor: COLORS.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginRight: 10 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  controlesCentrais: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  botaoPlay: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginHorizontal: 30 },
  botaoPular: { width: 50, height: 50, justifyContent: 'center', alignItems: 'center' },
  barraInferior: { position: 'absolute', bottom: 0, width: '100%', paddingHorizontal: 20, paddingBottom: 20 },
  areaProgresso: { height: 30, justifyContent: 'center' },
  toqueProgresso: { height: 20, justifyContent: 'center' },
  trilhaProgresso: { height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2 },
  progressoPreenchido: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 2 },
  linhaFerramentas: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  botaoFerramenta: { width: 35, height: 35, justifyContent: 'center', alignItems: 'center' },
  tempo: { color: '#fff', fontSize: 12, marginLeft: 10 },
  volumeWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  areaVolume: { width: 80, height: 30, justifyContent: 'center', marginLeft: 5 },
  toqueVolume: { height: 20, justifyContent: 'center' },
  trilhaVolume: { height: 3, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 1.5 },
  volumePreenchido: { height: '100%', backgroundColor: '#fff', borderRadius: 1.5 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', zIndex: 20 },
  textoOverlay: { color: '#fff', marginTop: 15, fontSize: 14 },
  textoErro: { color: '#fff', marginTop: 15, textAlign: 'center', paddingHorizontal: 40 },
  botaoErro: { marginTop: 25, backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 5 },
  textoBotaoErro: { color: '#fff', fontWeight: 'bold' },
  botaoVoltarErro: { marginTop: 15 },
  textoBotaoVoltar: { color: 'rgba(255,255,255,0.6)' },
});
