import React, { useState } from 'react';
import {
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useNavigation, useRoute } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS } from '../utils/constants';

export default function LivePlayerScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { embeds = [], titulo = 'Canal ao Vivo' } = route.params || {};
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);

  // Pega o primeiro embed disponível
  const embedUrl = embeds[0]?.embed_url;

  // Script para tentar forçar o autoplay no iframe e remover alguns elementos indesejados se possível
  const injectedJS = `
    (function() {
      const video = document.querySelector('video');
      if (video) {
        video.play();
        video.muted = false;
      }
      // Tentar clicar em botões de play que aparecem em alguns players
      const playBtn = document.querySelector('.vjs-big-play-button') || document.querySelector('.play-button');
      if (playBtn) playBtn.click();
    })();
    true;
  `;

  if (!embedUrl) {
    return (
      <View style={styles.container}>
        <StatusBar hidden />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.titulo}>{titulo}</Text>
        </View>
        <View style={styles.center}>
          <MaterialCommunityIcons name="alert-circle-outline" size={60} color={COLORS.primary} />
          <Text style={styles.erroTexto}>Nenhuma fonte disponível para este canal.</Text>
          <TouchableOpacity style={styles.voltarBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.voltarTexto}>VOLTAR</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.titulo} numberOfLines={1}>{titulo}</Text>
      </View>

      <View style={styles.playerContainer}>
        <WebView
          source={{ 
            uri: embedUrl,
            headers: {
              'Referer': 'https://reidoscanais.st/',
              'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36'
            }
          }}
          style={styles.webview}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowsFullscreenVideo={true}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          onLoadStart={() => setCarregando(true)}
          onLoadEnd={() => {
            setCarregando(false);
          }}
          onError={() => {
            setCarregando(false);
            setErro(true);
          }}
          injectedJavaScript={injectedJS}
          backgroundColor="#000"
        />
        
        {carregando && (
          <View style={[StyleSheet.absoluteFill, styles.loadingOverlay]}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingTexto}>Sintonizando canal...</Text>
          </View>
        )}

        {erro && (
          <View style={[StyleSheet.absoluteFill, styles.loadingOverlay]}>
            <MaterialCommunityIcons name="television-off" size={60} color={COLORS.primary} />
            <Text style={styles.erroTexto}>Erro ao carregar transmissão.</Text>
            <TouchableOpacity style={styles.voltarBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.voltarTexto}>VOLTAR</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <MaterialCommunityIcons name="information-outline" size={16} color="rgba(255,255,255,0.5)" />
        <Text style={styles.footerTexto}>
          Alguns canais podem demorar alguns segundos para iniciar.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    backgroundColor: '#000',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titulo: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
    flex: 1,
  },
  playerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingOverlay: {
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingTexto: {
    color: '#fff',
    marginTop: 15,
    fontSize: 14,
  },
  erroTexto: {
    color: '#fff',
    marginTop: 15,
    textAlign: 'center',
    fontSize: 16,
  },
  voltarBtn: {
    marginTop: 20,
    paddingHorizontal: 30,
    paddingVertical: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  voltarTexto: {
    color: '#fff',
    fontWeight: 'bold',
  },
  footer: {
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#050505',
  },
  footerTexto: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    marginLeft: 8,
    textAlign: 'center',
  },
});
