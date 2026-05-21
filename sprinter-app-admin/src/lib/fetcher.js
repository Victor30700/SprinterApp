export const fetcher = async (url) => {
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) {
      throw new Error('Error en el fetch');
    }
    return res.json();
  };
  