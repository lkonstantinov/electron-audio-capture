const { app, BrowserWindow, desktopCapturer, session } = require('electron')
const path = require('node:path')

const { ipcMain } = require("electron");
const fs = require("fs/promises");

ipcMain.handle("writeFile", (event, path, data) => {
  console.log("writing file to " + path);
  return fs.writeFile(path, data);
});

app.whenReady().then(async () => {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  })

  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['window', 'screen'] }).then((sources) => {
      // Grant access to the first screen found.
      callback({ video: sources[0], audio: 'loopback' })
    })
    // MacOS only
  }, { useSystemPicker: true })

  mainWindow.loadFile('index.html')
})