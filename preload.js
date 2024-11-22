const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nodeAPI', {
	bufferAlloc: (size) => Buffer.alloc(size),
	writeFile: (path, data) => {
		return ipcRenderer.invoke("writeFile", path, data);
	}
});
