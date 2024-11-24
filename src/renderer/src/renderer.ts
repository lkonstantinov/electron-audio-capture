// eslint-disable-next-line @typescript-eslint/no-unused-vars
function init(): void {
  window.addEventListener('DOMContentLoaded', () => {
    // doAThing()
  })
}

// function doAThing(): void {
//   const versions = window.electron.process.versions
//   replaceText('.electron-version', `Electron v${versions.electron}`)
//   replaceText('.chrome-version', `Chromium v${versions.chrome}`)
//   replaceText('.node-version', `Node v${versions.node}`)

//   const ipcHandlerBtn = document.getElementById('ipcHandler')
//   ipcHandlerBtn?.addEventListener('click', () => {
//     window.electron.ipcRenderer.send('ping')
//   })
// }

// function replaceText(selector: string, text: string): void {
//   const element = document.querySelector<HTMLElement>(selector)
//   if (element) {
//     element.innerText = text
//   }
// }

init()

const startButton = document.getElementById('startButton')
const stopButton = document.getElementById('stopButton')

let chunks = []

// const socket = new WebSocket(import.meta.env.VITE_WS_URL)

// // Connection opened
// socket.addEventListener('open', (event) => {
//   socket.send('Hello Server!')
// })

// // Listen for messages
// socket.addEventListener('message', (event) => {
//   console.log('Message from server ', event.data)
// })

async function mic(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: true,
    video: false
  })
}

async function audio(): Promise<MediaStream> {
  return navigator.mediaDevices.getDisplayMedia({
    audio: true,
    video: {
      width: 320,
      height: 240,
      frameRate: 30
    }
  })
}

function mergeAudioStreams(
  audio_context: AudioContext,
  desktopStream: MediaStream,
  voiceStream: MediaStream
): MediaStreamTrack[] {
  // Create a couple of sources
  const source1 = audio_context.createMediaStreamSource(desktopStream)
  const source2 = audio_context.createMediaStreamSource(voiceStream)
  const destination = audio_context.createMediaStreamDestination()

  const gain = audio_context.createGain()
  gain.channelCountMode = 'explicit'
  gain.channelCount = 2

  source1.connect(gain)
  source2.connect(gain)
  gain.connect(destination)

  // const desktopGain = audio_context.createGain();
  // const voiceGain = audio_context.createGain();

  // desktopGain.gain.value = 0.7;
  // voiceGain.gain.value = 0.7;

  // source1.connect(desktopGain).connect(destination);
  // source2.connect(voiceGain).connect(destination);

  return destination.stream.getAudioTracks()
}

let recording_stream: MediaStream | null = null
let audio_context: AudioContext | null = null

function sampleRate(stream: MediaStream): number | undefined {
  return stream.getAudioTracks()[0].getSettings().sampleRate
}

if (startButton) {
  startButton.addEventListener('click', async () => {
    audio_context = new AudioContext({ sampleRate: 44100 })
    recording_stream = new MediaStream(mergeAudioStreams(audio_context, await audio(), await mic()))
    const audioSource = audio_context.createMediaStreamSource(recording_stream)

    await audio_context.audioWorklet.addModule(new URL('wave-loopback.js', import.meta.url))
    const waveLoopbackNode = new AudioWorkletNode(audio_context, 'wave-loopback')
    waveLoopbackNode.port.onmessage = (event): void => {
      const inputFrame = event.data
      // console.log(inputFrame)
      chunks = chunks.concat(inputFrame)
    }

    audioSource.connect(waveLoopbackNode)
    waveLoopbackNode.connect(audio_context.destination)

    console.log('Recording started')
  })
}

type WavOptions = {
  isFloat: boolean
  numChannels?: number
  sampleRate?: number
}

function getWavBytes(buffer: Float32Array, options: WavOptions): Uint8Array {
  // adapted from https://gist.github.com/also/900023
  // returns Uint8Array of WAV header bytes
  function getWavHeader(options: WavOptions, numFrames: number): Uint8Array {
    // const numFrames = options.numFrames
    const numChannels = options.numChannels || 2
    const sampleRate = options.sampleRate || 44100
    const bytesPerSample = options.isFloat ? 4 : 2
    const format = options.isFloat ? 3 : 1

    const blockAlign = numChannels * bytesPerSample
    const byteRate = sampleRate * blockAlign
    const dataSize = numFrames * blockAlign

    const buffer = new ArrayBuffer(44)
    const dv = new DataView(buffer)

    let p = 0

    function writeString(s: string): void {
      for (let i = 0; i < s.length; i++) {
        dv.setUint8(p + i, s.charCodeAt(i))
      }
      p += s.length
    }

    function writeUint32(d: number): void {
      dv.setUint32(p, d, true)
      p += 4
    }

    function writeUint16(d: number): void {
      dv.setUint16(p, d, true)
      p += 2
    }

    writeString('RIFF') // ChunkID
    writeUint32(dataSize + 36) // ChunkSize
    writeString('WAVE') // Format
    writeString('fmt ') // Subchunk1ID
    writeUint32(16) // Subchunk1Size
    writeUint16(format) // AudioFormat https://i.sstatic.net/BuSmb.png
    writeUint16(numChannels) // NumChannels
    writeUint32(sampleRate) // SampleRate
    writeUint32(byteRate) // ByteRate
    writeUint16(blockAlign) // BlockAlign
    writeUint16(bytesPerSample * 8) // BitsPerSample
    writeString('data') // Subchunk2ID
    writeUint32(dataSize) // Subchunk2Size

    return new Uint8Array(buffer)
  }

  const type = options.isFloat ? Float32Array : Uint16Array
  const numFrames = buffer.byteLength / type.BYTES_PER_ELEMENT

  const headerBytes = getWavHeader(options, numFrames)
  const wavBytes = new Uint8Array(headerBytes.length + buffer.byteLength)

  // prepend header, then add pcmBytes
  wavBytes.set(headerBytes, 0)
  wavBytes.set(new Uint8Array(buffer.buffer), headerBytes.length)

  return wavBytes
}

if (stopButton) {
  stopButton.addEventListener('click', async () => {
    if (recording_stream == null) {
      return
    }

    const sr = sampleRate(recording_stream)
    recording_stream.getTracks().forEach((track) => track.stop())
    recording_stream = null

    if (audio_context) {
      audio_context.close()
      audio_context = null
    }

    console.log(`sampleRate: ${sr}`)

    // get WAV file bytes and audio params of your audio source
    const wavBytes = getWavBytes(new Float32Array(chunks), {
      isFloat: true, // floating point or 16-bit integer
      numChannels: 1,
      sampleRate: sr
    })
    // const wavBytes = buildWavSpecification(chunks);

    await window.nodeAPI.writeFile('out.wav', wavBytes)

    chunks = []

    console.log('Recording stopped')
  })
}
