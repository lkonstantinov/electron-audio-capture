class WaveLoopback extends AudioWorkletProcessor {

    process(inputs, outputs, parameters) {
        this.pushData(inputs[0][0]);

        this.port.postMessage(this.buffer);
        this.buffer = [];

        return true;
    }

    pushData(samples) {
        for (var i = 0; i < samples.length; i++) {
            this.buffer.push(samples[i]);
        }
    }

    constructor() {
        super();
        this.buffer = [];
    }
}

registerProcessor('wave-loopback', WaveLoopback);