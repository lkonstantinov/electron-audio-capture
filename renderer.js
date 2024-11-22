// renderer.js
const startButton = document.getElementById('startButton')
const stopButton = document.getElementById('stopButton')

let mediaRecorder;
let chunks = [];

async function mic() {
	return navigator.mediaDevices.getUserMedia({
		audio: true,
		video: false
	})
}

async function audio() {
	return navigator.mediaDevices.getDisplayMedia({
		audio: true,
		video: {
			width: 320,
			height: 240,
			frameRate: 30
		}
	})
}

function mergeAudioStreams(audio_context, desktopStream, voiceStream) {

	// Create a couple of sources
	const source1 = audio_context.createMediaStreamSource(desktopStream);
	const source2 = audio_context.createMediaStreamSource(voiceStream);
	const destination = audio_context.createMediaStreamDestination();

	const gain = audio_context.createGain();
	gain.ChannelCountMode = 'explicit';
	gain.ChannelCount = 2;

	source1.connect(gain);
	source2.connect(gain);
	gain.connect(destination);


	// const desktopGain = audio_context.createGain();
	// const voiceGain = audio_context.createGain();

	// desktopGain.gain.value = 0.7;
	// voiceGain.gain.value = 0.7;

	// source1.connect(desktopGain).connect(destination);
	// source2.connect(voiceGain).connect(destination);

	return destination.stream.getAudioTracks();
};

let recording_stream = null;
let audio_context = null;

function sampleRate(stream) {
	return stream.getAudioTracks()[0].getSettings().sampleRate;
}

startButton.addEventListener('click', async () => {

	audio_context = new AudioContext();
	recording_stream = new MediaStream(mergeAudioStreams(audio_context, await audio(), await mic()));
	const audioSource = audio_context.createMediaStreamSource(recording_stream);

	await audio_context.audioWorklet.addModule('wave-loopback.js');
	const waveLoopbackNode = new AudioWorkletNode(audio_context, 'wave-loopback');
	waveLoopbackNode.port.onmessage = (event) => {
		const inputFrame = event.data;
		// console.log(inputFrame)
		chunks = chunks.concat(inputFrame);
	};

	audioSource.connect(waveLoopbackNode);
	waveLoopbackNode.connect(audio_context.destination);

	console.log("Recording started");
})

function getWavBytes(buffer, options) {

	// adapted from https://gist.github.com/also/900023
	// returns Uint8Array of WAV header bytes
	function getWavHeader(options) {
		const numFrames = options.numFrames
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

		function writeString(s) {
			for (let i = 0; i < s.length; i++) {
				dv.setUint8(p + i, s.charCodeAt(i))
			}
			p += s.length
		}

		function writeUint32(d) {
			dv.setUint32(p, d, true)
			p += 4
		}

		function writeUint16(d) {
			dv.setUint16(p, d, true)
			p += 2
		}

		writeString('RIFF')              // ChunkID
		writeUint32(dataSize + 36)       // ChunkSize
		writeString('WAVE')              // Format
		writeString('fmt ')              // Subchunk1ID
		writeUint32(16)                  // Subchunk1Size
		writeUint16(format)              // AudioFormat https://i.sstatic.net/BuSmb.png
		writeUint16(numChannels)         // NumChannels
		writeUint32(sampleRate)          // SampleRate
		writeUint32(byteRate)            // ByteRate
		writeUint16(blockAlign)          // BlockAlign
		writeUint16(bytesPerSample * 8)  // BitsPerSample
		writeString('data')              // Subchunk2ID
		writeUint32(dataSize)            // Subchunk2Size

		return new Uint8Array(buffer)
	}


	const type = options.isFloat ? Float32Array : Uint16Array
	const numFrames = buffer.byteLength / type.BYTES_PER_ELEMENT

	const headerBytes = getWavHeader(Object.assign({}, options, { numFrames }))
	const wavBytes = new Uint8Array(headerBytes.length + buffer.byteLength);

	// prepend header, then add pcmBytes
	wavBytes.set(headerBytes, 0)
	wavBytes.set(new Uint8Array(buffer.buffer), headerBytes.length)

	return wavBytes
}



stopButton.addEventListener('click', async () => {

	const sr = sampleRate(recording_stream);
	if (recording_stream) {
		recording_stream.getTracks().forEach((track) => track.stop());
		recording_stream = null;
	}

	if (audio_context) {
		audio_context.close();
		audio_context = null;
	}

	console.log(`sampleRate: ${sr}`);

	// get WAV file bytes and audio params of your audio source
	const wavBytes = getWavBytes(new Float32Array(chunks), {
		isFloat: true,       // floating point or 16-bit integer
		numChannels: 1,
		sampleRate: sr,
	})
	// const wavBytes = buildWavSpecification(chunks);


	await window.nodeAPI.writeFile("buhal.wav", wavBytes);

	chunks = [];

	console.log("Recording stopped");
})
