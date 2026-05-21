const API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

export const sendMessageToGPT = async (messageHistory) => {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      // CAMBIO IMPORTANTE: Usamos gpt-4o-mini (rápido, barato e inteligente) 
      // o gpt-4o (más costoso pero máximo razonamiento)
      body: JSON.stringify({
        model: 'gpt-4o-mini', 
        messages: messageHistory,
        temperature: 0.7, // Creatividad equilibrada para consejos
        max_tokens: 1000, // Permitir respuestas detalladas
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Error ${response.status}: ${errorData.error?.message || 'No se pudo obtener respuesta'}`
      );
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error("Error en OpenAI Service:", error);
    throw error;
  }
};