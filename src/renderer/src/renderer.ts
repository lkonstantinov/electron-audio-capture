import { Recorder } from './recorder'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function init(): void {
  window.addEventListener('DOMContentLoaded', () => {
    const startButton = document.getElementById('startButton')
    const stopButton = document.getElementById('stopButton')
    const recorder = new Recorder()

    if (stopButton) {
      stopButton.addEventListener('click', recorder.stopRecording)
    }

    if (startButton) {
      startButton.addEventListener('click', recorder.startRecording)
    }

    // connectServer(import.meta.env.VITE_WS_URL)
  })
}

init()

// function connectServer(url: string): void {
//   const socket = new WebSocket(url)

//   socket.addEventListener('open', (_event) => {
//     socket.send('Hello Server!')
//   })

//   socket.addEventListener('message', (event) => {
//     console.log('Message from server ', event.data)
//   })
// }







