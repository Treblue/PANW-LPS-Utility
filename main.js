const { app, dialog, BrowserWindow, Menu } = require("electron");
const path = require("path");

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win, about;
let once = false;

function createAboutWindow() {
    /* Create the browser window. */
    about = new BrowserWindow({
        parent: win,
        width: 245,
        height: 132,
        useContentSize: true,
        resizable: false,
        frame: false,
        show: false,
        icon: path.join(__dirname, "assets/icons/png/1024x1024.png")
    });

    about.setAlwaysOnTop(true);

    about.once("ready-to-show", () => about.show());

    about.loadFile("web/about.html");

    about.on('closed', () => {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        about = null;
    });
}

function createWindow() {
    Menu.setApplicationMenu(Menu.buildFromTemplate([{
        label: "Application",
        submenu: [
            { label: "About Application", click: () => createAboutWindow() },
            { label: "Toggle Console", click: () => toggleDeveloperConsole() },
            { type: "separator" },
            { label: "Quit", accelerator: "Command+Q", click: () => app.quit() }
        ]}, {
        label: "Edit",
        submenu: [
            { label: "Undo", accelerator: "CmdOrCtrl+Z", selector: "undo:" },
            { label: "Redo", accelerator: "Shift+CmdOrCtrl+Z", selector: "redo:" },
            { type: "separator" },
            { label: "Cut", accelerator: "CmdOrCtrl+X", selector: "cut:" },
            { label: "Copy", accelerator: "CmdOrCtrl+C", selector: "copy:" },
            { label: "Paste", accelerator: "CmdOrCtrl+V", selector: "paste:" },
            { label: "Select All", accelerator: "CmdOrCtrl+A", selector: "selectAll:" }
        ]}
    ]));

    /* Create the browser window. */
    win = new BrowserWindow({
        width: 800,
        height: 697,
        minWidth: 800,
        useContentSize: true,
        show: false,
        titleBarStyle: process.platform !== "darwin" ? "hidden" : "hiddenInset",
        icon: path.join(__dirname, "assets/icons/png/1024x1024.png")
    });

    win.once("ready-to-show", () => win.show());

    win.loadFile('web/index.html');

    win.on('closed', () => {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        win = null;
    });
}

function toggleDeveloperConsole() {
    if (!once) {
        once = true;

        dialog.showMessageBox({
            type: "info",
            buttons: ["Ok"],
            message: "You have just opened the developer console. The messages you see may look cluttered and confusing as they are only intended to be understood by certain skilled users."
        });
    }
    win.toggleDevTools();
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (win === null) {
        createWindow();
    }
});