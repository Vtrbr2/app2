import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Header from '../components/Header';
import { carregarCanais, carregarCategoriasCanais, buscarCanais } from '../services/live';
import { COLORS } from '../utils/constants';

export default function CanaisAoVivoScreen() {
  const navigation = useNavigation();
  const [canais, setCanais] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [categoriaAtiva, setCategoriaAtiva] = useState('Todas');
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');

  const inicializar = useCallback(async () => {
    setCarregando(true);
    const [dadosCanais, dadosCategorias] = await Promise.all([
      carregarCanais(),
      carregarCategoriasCanais(),
    ]);
    setCanais(dadosCanais);
    setCategorias(['Todas', ...dadosCategorias]);
    setCarregando(false);
  }, []);

  useEffect(() => {
    inicializar();
  }, [inicializar]);

  const filtrarPorCategoria = async (cat) => {
    if (cat === categoriaAtiva) return;
    setCategoriaAtiva(cat);
    setCarregando(true);
    setBusca('');
    const dados = await carregarCanais(cat === 'Todas' ? '' : cat);
    setCanais(dados);
    setCarregando(false);
  };

  const realizarBusca = async (texto) => {
    setBusca(texto);
    if (texto.length > 2) {
      setCarregando(true);
      const resultados = await buscarCanais(texto);
      setCanais(resultados);
      setCarregando(false);
    } else if (texto.length === 0) {
      filtrarPorCategoria(categoriaAtiva);
    }
  };

  const renderCanal = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => navigation.navigate('Player', { 
        isLive: true,
        canalId: item.id,
        titulo: item.name,
        embeds: item.embeds,
        logo: item.logo_url
      })}
    >
      <View style={styles.logoContainer}>
        <Image source={{ uri: item.logo_url }} style={styles.logo} resizeMode="contain" />
        <View style={styles.badgeLive}>
          <Text style={styles.badgeText}>AO VIVO</Text>
        </View>
      </View>
      <View style={styles.info}>
        <Text style={styles.nome} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.categoria} numberOfLines={1}>{item.category}</Text>
        {item.epg?.current && (
          <Text style={styles.epg} numberOfLines={1}>
            Agora: {item.epg.current.title}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Header ativo="ao-vivo" />
      
      <View style={styles.buscaContainer}>
        <View style={styles.inputWrap}>
          <MaterialCommunityIcons name="magnify" size={20} color="rgba(255,255,255,0.5)" />
          <TextInput
            style={styles.input}
            placeholder="Buscar canal..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={busca}
            onChangeText={realizarBusca}
          />
        </View>
      </View>

      <View style={styles.filtrosWrap}>
        <FlatList
          horizontal
          data={categorias}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtrosList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.filtro, categoriaAtiva === item && styles.filtroAtivo]}
              onPress={() => filtrarPorCategoria(item)}
            >
              <Text style={[styles.filtroText, categoriaAtiva === item && styles.filtroTextAtivo]}>
                {item}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {carregando ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={canais}
          keyExtractor={(item) => item.id}
          renderItem={renderCanal}
          numColumns={2}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>Nenhum canal encontrado.</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  buscaContainer: {
    padding: 15,
    paddingBottom: 5,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 45,
  },
  input: {
    flex: 1,
    color: '#fff',
    marginLeft: 10,
    fontSize: 15,
  },
  filtrosWrap: {
    height: 50,
    marginBottom: 5,
  },
  filtrosList: {
    paddingHorizontal: 15,
    alignItems: 'center',
  },
  filtro: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  filtroAtivo: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filtroText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '600',
  },
  filtroTextAtivo: {
    color: '#fff',
  },
  list: {
    padding: 10,
  },
  card: {
    flex: 1,
    margin: 6,
    backgroundColor: '#0f0f0f',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  logoContainer: {
    width: '100%',
    height: 100,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 15,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  badgeLive: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  info: {
    padding: 10,
  },
  nome: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  categoria: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    marginTop: 2,
  },
  epg: {
    color: COLORS.primary,
    fontSize: 10,
    marginTop: 4,
    fontWeight: '500',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginTop: 50,
  },
});
