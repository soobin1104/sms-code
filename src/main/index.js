import { app, shell, BrowserWindow, ipcMain, clipboard, Notification } from 'electron'
import { join } from 'path'
import { exec } from 'child_process'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import permissions from 'node-mac-permissions'
import sqlite3 from 'sqlite3'
import os from 'os'

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      enableRemoteModule: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // 请求辅助功能权限
  ipcMain.handle('request-permission', () => {
    const url = 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
    exec(`open "${url}"`, (error) => {
      if (error) {
        console.error(`Error opening Accessibility settings: ${error}`)
      }
    })
  })

  // 检查辅助功能权限状态
  ipcMain.handle('check-permission', async () => {
    const status = permissions.getAuthStatus('accessibility')
    return status === 'authorized'
  })

  // 获取验证码
  ipcMain.handle('fetch-code', async () => {
    console.log('Fetching code...')
    return new Promise((resolve, reject) => {
      const dbPath = `${os.homedir()}/Library/Messages/chat.db` // 使用动态路径

      // 打开SQLite数据库
      const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
          console.error('Could not open database:', err)
          reject('无法打开数据库')
          return
        }
      })

      // 查询最近60秒的消息内容
      const query = `
        SELECT text FROM message
        WHERE datetime(date/1000000000 + 978307200, "unixepoch", "localtime") > datetime("now", "localtime", "-60 second")
        ORDER BY date DESC LIMIT 1
      `

      db.get(query, (err, row) => {
        db.close()

        if (err) {
          console.error('Database query error:', err)
          reject('数据库查询出错')
          return
        }

        if (row && row.text.includes('验证码')) {
          const code = row.text.match(/\b\d{4,6}\b/) // 提取4到6位数字
          if (code) {
            clipboard.writeText(code[0]) // 将验证码复制到剪贴板
            new Notification({
              title: '验证码已复制',
              body: `验证码 ${code[0]} 已复制到剪贴板`
            }).show()
            resolve(code[0])
          } else {
            resolve('未找到验证码')
          }
        } else {
          new Notification({
            title: '提示',
            body: '最近60秒未收到验证码！'
          }).show()
          resolve('未找到验证码')
        }
      })
    })
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
