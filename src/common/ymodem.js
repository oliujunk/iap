const MODEM_SOH = 0x01; // 133字节数据包类型，接收正常回应0x06(含文件信息的第一个包接收正常需回应0x06、0x43)
const MODEM_STX = 0x02; // 1029字节数据包类型，接收正常回应0x06
const MODEM_EOT = 0x04; // 发送文件传输结束命令，接收正常回应0x06、0x43(启动空包发送)
const MODEM_ACK = 0x06; // 发送确认应答，接收方crc校验成功或收到已定义的命令
const MODEM_NAK = 0x15; // 发送重传当前数据包请求，接收方crc校验出错
const MODEM_CAN = 0x18; // 发送取消传输命令,连续发送5个字符
const MODEM_C = 0x43; // 发送大写字母C(三种情况下发送该字符: 1.启动通信握手.2.启动数据包发送.3.启动空包发送)
const MODEM_DUMMY = 0x1A; // 空白填充字节

function ymodemCrc(arrBytes, offset, len) {
  let checkSum = 0;

  for (let i = offset; i < offset + len; i++) {
    checkSum ^= arrBytes[i] << 8;
    for (let j = 0; j < 8; j += 1) {
      if (checkSum & 0x8000) {
        checkSum = (checkSum << 1) ^ 0x1021;
      } else {
        checkSum <<= 1;
      }
    }
  }

  return checkSum & 0xffff;
}

function modbusCrc(arrBytes, offset, len) {
  let CRC = 0xffff;
  const POLYNOMIAL = 0xA001;

  for (let i = 0; i < len; i++) {
    CRC ^= arrBytes[i + offset] & 0x00ff;
    for (let j = 0; j < 8; j += 1) {
      if ((CRC & 0x0001) !== 0) {
        CRC >>= 1;
        CRC ^= POLYNOMIAL;
      } else {
        CRC >>= 1;
      }
    }
  }

  return CRC;
}

function hexString2Bytes(str) {
  let pos = 0;
  let len = str.length;
  if (len % 2 !== 0) {
    return null;
  }
  len /= 2;
  const arrBytes = new Array(len);
  for (let i = 0; i < len; i += 1) {
    const s = str.substr(pos, 2);
    const v = parseInt(s, 16);
    arrBytes.push(v);
    pos += 2;
  }
  return arrBytes;
}

function bytes2HexString(arrBytes) {
  let str = '';
  for (let i = 0; i < arrBytes.length; i += 1) {
    let tmp;
    const num = arrBytes[i];
    if (num < 0) {
      tmp = (255 + num + 1).toString(16);
    } else {
      tmp = num.toString(16);
    }
    if (tmp.length === 1) {
      tmp = `0${tmp}`;
    }
    str += tmp;
  }
  return str;
}

function firstFrame(fileName, fileSize) {
  const send = new Array(133);

  for (let j = 0, len = send.length; j < len; j++) {
    send[j] = 0;
  }

  let i = 0;
  send[i++] = MODEM_SOH;
  send[i++] = 0;
  send[i++] = 0xFF;

  let fileNameCode = Array.from(fileName);
  fileNameCode = fileNameCode.map((code) => code.charCodeAt());

  for (let j = 0, len = fileNameCode.length; j < len; j++) {
    send[i++] = fileNameCode[j];
  }
  send[i++] = 0;

  let fileSizeCode = Array.from(fileSize.toString());
  fileSizeCode = fileSizeCode.map((code) => code.charCodeAt());

  for (let j = 0, len = fileSizeCode.length; j < len; j++) {
    send[i++] = fileSizeCode[j];
  }
  send[i++] = 0;

  const checkSum = ymodemCrc(send, 3, 128);

  send[131] = (checkSum >> 8) & 0xFF;
  send[132] = checkSum & 0xFF;

  return send;
}

function lastFrame() {
  const send = new Array(133);

  for (let j = 0, len = send.length; j < len; j++) {
    send[j] = 0;
  }

  send[0] = MODEM_SOH;
  send[1] = 0;
  send[2] = 0xFF;

  const checkSum = ymodemCrc(send, 3, 128);

  send[131] = (checkSum >> 8) & 0xFF;
  send[132] = checkSum & 0xFF;

  return send;
}

function dataFrame(data, offset, dataLen, packageNum) {
  let i = 0;
  let send;
  if (dataLen <= 128) {
    send = new Array(133);
    send[i++] = MODEM_SOH;
    send[i++] = packageNum;
    send[i++] = ~packageNum;
    for (let j = 0; j < dataLen; j++) {
      send[i++] = data[j + offset];
    }
    for (let j = dataLen; j < 128; j++) {
      send[i++] = MODEM_DUMMY;
    }
    const checkSum = ymodemCrc(send, 3, 128);

    send[131] = (checkSum >> 8) & 0xFF;
    send[132] = checkSum & 0xFF;
  } else {
    send = new Array(1029);
    send[i++] = MODEM_STX;
    send[i++] = packageNum;
    send[i++] = ~packageNum;
    for (let j = 0; j < dataLen; j++) {
      send[i++] = data[j + offset];
    }
    for (let j = dataLen; j < 1024; j++) {
      send[i++] = MODEM_DUMMY;
    }
    const checkSum = ymodemCrc(send, 3, 1024);

    send[1027] = (checkSum >> 8) & 0xFF;
    send[1028] = checkSum & 0xFF;
  }

  return send;
}

export {
  MODEM_SOH,
  MODEM_STX,
  MODEM_EOT,
  MODEM_ACK,
  MODEM_NAK,
  MODEM_CAN,
  MODEM_C,
  MODEM_DUMMY,
  ymodemCrc,
  modbusCrc,
  hexString2Bytes,
  bytes2HexString,
  firstFrame,
  dataFrame,
  lastFrame,
};
