const fs = require('fs')
const fetch = require('node-fetch')

/**
 * 校园网登录核心部分
 * @return bool
 */
async function loginChinaNet() {
  const headers = { Authorization: `Basic ${config.auth}` }
  return await fetch("https://www.loocha.com.cn:8443/login", {headers})
    .then(res=>res.json())
    .then(async json => {
      // console.log(json)
      const server_id = json.user.did.split("#")[0]
      const id = json.user.id
      // 获取server_id 和Id并保存
      config.server_id = server_id
      config.id = id
      return await doOnline()
    })
}
/**
 * 验证账户密码的合法性
 * @return void
 */
async function doFirstVerify() {
  global.config = require('./config.json')
  if (config.account == "" || config.passwd == "")
    throw new Error("[!] 请填写掌上大学的账户与密码...")
  if(config.auth == undefined) {
    let AUTH = new Buffer(`${config.account}:${config.passwd}`).toString('base64')
    let headers = { "Authorization": `Basic ${AUTH}` }
    return await fetch('https://www.loocha.com.cn:8443/login', { headers })
      .then(res=>{
        if (!res.ok) {
          throw new Error("[!] 账户或密码出错...")
        }
        return res.json()
      })
      .then(json=>{
        const server_id = json.user.did.split("#")[0]
        const id = json.user.id
        config.server_id = server_id
        config.id = id
        config.auth = AUTH
        delete config.account
        delete config.passwd
        console.log('[*] 账户验证成功！已加密账户名和密码.')
      })
  }
}

/**
 * 保存配置到本地文件
 * @return {void}
 */
async function saveConfig() {
  fs.writeFileSync('./config.json', JSON.stringify(config, null, 2))
}

/**
 * 输出当前在线设备数量
 * @return {void}
 */
async function checkLogin() {
  const headers = { "Authorization": `Basic ${config.auth}`}
  return await fetch(`https://wifi.loocha.cn/${config.id}/wifi/status`, {headers})
    .then(res=>res.ok?res.json():"401 Unauthorized")
    .then(json=>{
      let len = json.wifiOnlines.onlines.length
      console.log(`[*] 当前在线设备${len}个.`)
    })
}

/**
 * 对应选项2 下线
 * @return {void}
 */
async function kickOffDevice() {
  const headers = { Authorization: `Basic ${config.auth}` }
  const id = config.id
  const wan_ip = config.wan_ip
  const bras_ip = config.bras_ip

  console.log("[*] 正在下线设备中...")
  
  return await fetch(`https://wifi.loocha.cn/${id}/wifi/kickoff?wanip=${wan_ip}&brasip=${bras_ip}`, {
    method: "DELETE",
    headers
  }).then(res=>{
      if (res.ok) {
        console.log("[*] 下线成功...")
      } else {
        console.log("[!] 下线失败...")
      }
    })
}

/**
 * 获取上网所需的动态密码
 * @return {String}
 */
async function getPasswd() {
  const headers = { Authorization: `Basic ${config.auth}` }
  const id = config.id
  const server_id = config.server_id
  return await fetch(`https://wifi.loocha.cn/${id}/wifi?server_did=${server_id}`, {headers})
    .then(res => res.json())
    .then(json => json.telecomWifiRes.password)
}

/**
 * 获取上线所需要的QRCode代码
 * @return {String}
 */
async function getQrCode() {
  await initial()
  let wan_ip = config.wan_ip
  let bras_ip = config.bras_ip
  return await fetch(`https://wifi.loocha.cn/0/wifi/qrcode?brasip=${bras_ip}&ulanip=${wan_ip}&wlanip=${wan_ip}`)
    .then(res => res.json())
    .then(json => {
      // status=60011 当前设备在线
      if (json.status == "0")
        return json.telecomWifiRes.password
    })
}

/**
 * 初始化用户IP
 * @return {void}
 */
async function initial() {
  return await fetch("http://test.f-young.cn", {redirect: 'manual'})
    .then(res=>res.headers.get('Location'))
    .then(url=>{
      if (url!=undefined) {
        // console.log(url)
        const args = url.split('?')[1].split('&')
        const wan_ip = args[0].split('=')[1]
        const bras_ip = args[1].split('=')[1]
  
        config.wan_ip = wan_ip
        config.bras_ip = bras_ip
      }
    })
}

/**
 * 上线操作
 * @return {Promise}
 */
async function doOnline() {
  const headers = { Authorization: `Basic ${config.auth}` }

  const code = await getPasswd()
  console.log(`[*] => 本次登录密码[${code}].`)

  const qrcode = await getQrCode()
  // if (qrcode==undefined) 
  //   throw new Error("[!] 未获取到QRCode...")
  console.log(`[*] => 本次QRCode[${qrcode}].`)

  
  const param = `qrcode=${qrcode}&code=${code}&type=1`

  return await fetch(`https://wifi.loocha.cn/${config.id}/wifi/enable?${param}`, {
      method: "POST",
      headers
    })
    .then(res=>res.json())
    .then(json=>{
      if (json.status == "0") {
        console.log(`[*] 服务器回应：${json.response}`, '[登录成功...]')
      }
      else if (json.status == "60006") {
        // 当qrcode==undefined时的返回码
        console.log("[!] 当前设备已登录.")
      }
      else {
        console.log(json)
      }
    })
}


(async function() {

if (!fs.existsSync('./config.json')) {
  console.error("[!] 你没有填写config.json文件竟然还想登录QAQ...")
  return
}

// 第一步：验证账户和密码的合法性并加密写入config
await doFirstVerify().catch(err=>console.log(err))

// 第二步：登录
await loginChinaNet().catch(err=>console.log(err))

// 第三步：输出当前在线的设备数量
await checkLogin().catch(err=>console.log(err))

// 可选项：下线当前设备
//await kickOffDevice()

// 第四步：保存当前配置文件
await saveConfig()

})()
