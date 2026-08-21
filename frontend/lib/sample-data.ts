import { Video, TranscriptSegment } from './types'

const sampleTranscripts = [
  "Oye, ¿tú sabías que esto es súper fácil? Te lo explico: cuando tú haces esto, contigo todo cambia. Mira, te cuento mi experiencia...",
  "Hola a todos, hoy les voy a mostrar algo increíble. Usted no va a creer lo que voy a compartir. Si te interesa, quédate hasta el final.",
  "¿Vos entendés lo que te digo? Esto es para ti, mirá cómo funciona. Te prometo que te va a encantar el resultado.",
  "Escucha, te tengo que contar algo. ¿Tú crees que esto es difícil? No, te aseguro que contigo va a ser diferente.",
  "Atención: si usted está buscando la solución, aquí la tiene. Te voy a mostrar paso a paso cómo hacerlo.",
  "¡Ey! ¿Qué onda? Te traigo este tip increíble. Vos sabés que siempre te doy los mejores consejos, ¿no?",
  "Bueno, ustedes me pidieron esto y aquí está. Te lo explico fácil: primero tú haces esto, luego contigo será más sencillo.",
  "Mira, te cuento: esto cambió mi vida. Si tú estás pasando por lo mismo, te aseguro que te va a servir.",
  "¿Sabés qué? Te voy a dar un secreto. Usted puede lograr esto si sigue estos pasos conmigo.",
  "Hola mi gente, hoy les traigo algo especial. Te lo prometí y aquí está. ¿Vos ya lo probaste?",
  "Escuchame bien, te estoy hablando a ti. Esto es importante para usted si quiere mejorar.",
  "¿Tú me escuchas? Bien, te explico: contigo todo es más fácil. Te doy mi palabra.",
  "Amigos, les cuento que esto es genial. Te va a encantar, te lo aseguro. ¿Usted qué opina?",
  "Oigan, vengan para acá. Te muestro cómo se hace. Vos vas a ver que es súper simple.",
  "¿Qué tal? Te saludo desde aquí. Tú sabes que siempre te traigo lo mejor, contigo siempre.",
  "Buenas, usted está viendo el video correcto. Te prometo que esto va a cambiar tu perspectiva.",
  "Hey, ¿vos estás ahí? Te hablo a ti directamente. Esto es para usted y para todos los que me siguen.",
  "Miren esto, te lo muestro en vivo. ¿Tú crees que es falso? Te demuestro que no.",
  "Atención por favor, te necesito concentrado. Contigo vamos a lograr grandes cosas, usted verá.",
  "¿Me escuchás? Perfecto, te cuento rápido. Vos podés hacer esto, te lo garantizo.",
  "Hola querido seguidor, te saludo con cariño. Tú eres importante para mí, contigo crecemos.",
  "Oye tú, sí tú, te estoy hablando. Usted tiene que ver esto, te va a sorprender.",
  "Bueno amigos, te traigo la continuación. ¿Vos te acordás del video anterior? Te lo recuerdo.",
  "Escuchen bien, te lo explico una vez más. Contigo podemos lograrlo, usted tiene el poder.",
]

function generateSegments(transcript: string, duration: number): TranscriptSegment[] {
  const sentences = transcript.split(/(?<=[.!?])\s+/).filter(s => s.trim())
  const segmentDuration = duration / sentences.length
  
  return sentences.map((text, index) => ({
    id: `seg-${index}`,
    startTime: Math.round(index * segmentDuration),
    endTime: Math.round((index + 1) * segmentDuration),
    text: text.trim()
  }))
}

const sampleDescriptions = [
  "Este es mi tip favorito del mes, espero que les sirva tanto como a mi. No olviden seguirme para mas contenido.",
  "Parte 3 de la serie que tanto me pidieron. Comenten si quieren mas videos asi.",
  "POV: descubriste el secreto que nadie te cuenta. Link en bio para mas info.",
  "Respondiendo a los comentarios de mi ultimo video. Ustedes son los mejores.",
  "Tutorial rapido que todos necesitan ver. Guardenlo para despues.",
  "Storytime: lo que me paso ayer no lo van a creer. Quédense hasta el final.",
  "Probando esto que vi en TikTok... funciona o no funciona?",
  "Mi rutina completa paso a paso. Dejen sus preguntas en comentarios.",
]

const sampleHashtagSets = [
  ['#storytime', '#parati', '#viral', '#fyp'],
  ['#tutorial', '#tips', '#aprendeentiktok', '#hack'],
  ['#vlog', '#dayinmylife', '#grwm', '#español'],
  ['#pov', '#relateable', '#humor', '#comedia'],
  ['#consejos', '#motivacion', '#crecimientopersonal', '#mindset'],
  ['#reaction', '#duet', '#respuesta', '#comunidad'],
  ['#receta', '#cocina', '#foodtok', '#comida'],
  ['#trend', '#challenge', '#baile', '#musica'],
]

const SAMPLE_VIDEO_URL = 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

const sampleVideos: Video[] = Array.from({ length: 24 }, (_, i) => {
  const transcript = sampleTranscripts[i % sampleTranscripts.length]
  const duration = Math.floor(seededRandom(i * 100) * 45) + 15
  const authorNum = Math.floor(seededRandom(i * 200) * 1000)
  const likes = Math.floor(seededRandom(i * 300) * 50000) + 100
  const description = sampleDescriptions[i % sampleDescriptions.length]
  const hashtags = sampleHashtagSets[i % sampleHashtagSets.length]
  return {
    id: `video-${i + 1}`,
    url: SAMPLE_VIDEO_URL,
    thumbnail: `https://picsum.photos/seed/${i + 1}/320/480`,
    transcript,
    segments: generateSegments(transcript, duration),
    duration,
    author: `@usuario_${authorNum}`,
    likes,
    description,
    hashtags,
  }
})

export function getDiscoveryVideos(): Video[] {
  return sampleVideos
}

export function getRandomVideo(): Video {
  const seed = typeof window !== 'undefined' ? Date.now() : 0
  const index = Math.floor(seededRandom(seed) * sampleTranscripts.length)
  const transcript = sampleTranscripts[index]
  const duration = Math.floor(seededRandom(seed + 100) * 45) + 15
  const authorNum = Math.floor(seededRandom(seed + 200) * 1000)
  const likes = Math.floor(seededRandom(seed + 300) * 50000) + 100
  const description = sampleDescriptions[index % sampleDescriptions.length]
  const hashtags = sampleHashtagSets[index % sampleHashtagSets.length]
  return {
    id: `video-${seed}-${index}`,
    url: SAMPLE_VIDEO_URL,
    thumbnail: `https://picsum.photos/seed/${seed}/320/480`,
    transcript,
    segments: generateSegments(transcript, duration),
    duration,
    author: `@usuario_${authorNum}`,
    likes,
    description,
    hashtags,
  }
}
