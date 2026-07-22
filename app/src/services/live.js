const API_LIVE = 'https://api.reidoscanais.st';

export async function carregarCanais(categoria = '') {
  try {
    const url = categoria 
      ? `${API_LIVE}/channels?category=${encodeURIComponent(categoria)}`
      : `${API_LIVE}/channels`;
    
    const resposta = await fetch(url);
    const json = await resposta.json();
    
    if (json.success && Array.isArray(json.data)) {
      return json.data;
    }
  } catch (erro) {
    console.error('Erro ao carregar canais ao vivo:', erro);
  }
  return [];
}

export async function carregarCategoriasCanais() {
  try {
    const resposta = await fetch(`${API_LIVE}/channels/categories`);
    const json = await resposta.json();
    
    if (json.success && Array.isArray(json.data)) {
      return json.data;
    }
  } catch (erro) {
    console.error('Erro ao carregar categorias de canais:', erro);
  }
  return [];
}

export async function buscarCanais(termo) {
  try {
    const resposta = await fetch(`${API_LIVE}/search?q=${encodeURIComponent(termo)}`);
    const json = await resposta.json();
    
    if (json.success && json.data?.channels) {
      return json.data.channels;
    }
  } catch (erro) {
    console.error('Erro ao buscar canais:', erro);
  }
  return [];
}

/**
 * Tenta resolver a URL final do stream (.m3u8) a partir do embed_url.
 * Como o Rei dos Canais usa embeds protegidos, o player nativo precisará
 * de headers específicos (Referer, User-Agent) e possivelmente de um
 * WebView oculto ou parsing do HTML se o link direto não for estável.
 */
export async function resolverUrlStream(embedUrl) {
  // Por enquanto, retornamos a URL do embed. 
  // No PlayerScreen, trataremos se for um link direto ou se precisa de WebView.
  return embedUrl;
}
