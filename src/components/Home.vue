<template>
  <div id="app">
    <a-row>
      <a-col :span="10">
        <a-card title="通信设置" :bordered="false" class="communication-setting">
          <el-col :span="8">
            <el-row type="flex" justify="end" align="middle">通信类型：</el-row>
            <el-row type="flex" justify="end" align="middle">串口号：</el-row>
            <el-row type="flex" justify="end" align="middle">设备地址：</el-row>
            <el-row type="flex" justify="end" align="middle">端口号：</el-row>
          </el-col>
          <el-col :span="12">
            <el-row type="flex" justify="start" align="middle">
              <el-radio-group
                v-model="linkType"
                size="samll"
                @change="onLinkTypeChange"
                :disabled="openButtonStatus"
              >
                <el-radio :label="1">串口</el-radio>
                <el-radio :label="2">网络</el-radio>
              </el-radio-group>
            </el-row>
            <el-row type="flex" justify="start" align="middle">
              <el-select
                v-model="currentPort"
                size="small"
                :disabled="linkType === 1 ? false : true"
              >
                <el-option
                  v-for="item in portList"
                  :key="item.comName"
                  :value="item.comName"
                  :label="item.comName"
                ></el-option>
              </el-select>
            </el-row>
            <el-row type="flex" justify="start" align="middle">
              <el-input v-model="address" size="small"></el-input>
            </el-row>
            <el-row type="flex" justify="start" align="middle">
              <el-input v-model="socketPort" size="small" :disabled="linkType === 1 ? true : false"></el-input>
            </el-row>
            <el-row>
              <div class="communication-setting-open">
                <el-button
                  :type="openButtonType"
                  size="small"
                  @click="onOpenPort"
                  round
                >{{openButtonText}}</el-button>
              </div>
            </el-row>
          </el-col>
        </a-card>
        <a-card title="文件选择" :bordered="false" class="file-select">
          <el-input placeholder="选择文件" v-model="fileUri">
            <el-button type="success" @click="onSelectFile" slot="append">选择文件</el-button>
          </el-input>
          <input type="file" id="btn_file" style="display:none" accept=".bin" @change="onGetUri">
        </a-card>
      </a-col>
      <a-col :span="14">
        <a-card title="烧写操作" :bordered="false" class="download-operation">
          <el-button
            type="primary"
            size="small"
            :disabled="!openButtonStatus"
            @click="onDetection"
          >检测设备</el-button>
          <el-button
            type="success"
            size="small"
            :disabled="!openButtonStatus || !binaryData"
            @click="onDownload"
          >开始烧写</el-button>
          <el-progress
            :text-inside="true"
            :stroke-width="18"
            :percentage="percentage"
            :status="progressStatus"
          ></el-progress>
        </a-card>
        <a-card title="通信信息" :bordered="false" class="communication-info">
          <el-input type="textarea" v-model="textarea" :rows="10" class="info-window"></el-input>
          <div class="clear-button">
            <el-button type="primary" plain size="mini" @click="onClearCommunicationInfo">清除信息</el-button>
          </div>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script>
import {
  MODEM_EOT,
  MODEM_NAK,
  firstFrame,
  dataFrame,
  lastFrame,
  modbusCrc,
} from '@/common/ymodem';

const SerialPort = require('serialport');
const InterByteTimeout = require('@serialport/parser-inter-byte-timeout');
const net = require('net');
const fs = require('fs');

export default {
  name: 'home',
  data() {
    return {
      linkType: 1,
      openButtonText: '打开串口',
      openButtonStatus: false,
      openButtonType: 'danger',
      portList: [],
      currentPort: '',
      address: 1,
      socketPort: 9999,
      fileUri: '',
      textarea: '',
      port: null,
      server: null,
      socket: null,
      percentage: 0,
      progressStatus: 'exception',
      binaryData: null,
      downloading: false,
      sumPkgNum: 0,
      curPkgNum: -1,
    };
  },
  methods: {
    onLinkTypeChange(value) {
      if (value === 1) {
        this.openButtonText = '打开串口';
        if (this.server) {
          this.server.close();
          this.server = null;
        }
      } else if (value === 2) {
        this.openButtonText = '开始监听';
      }
    },
    onSelectFile() {
      document.getElementById('btn_file').click();
    },
    onGetUri(e) {
      this.fileUri = e.target.files[0].path;
      const binaryData = fs.readFileSync(this.fileUri);
      this.binaryData = binaryData;
      this.sumPkgNum = Math.ceil(binaryData.length / 128);
    },
    onOpenPort() {
      if (this.linkType === 1) {
        // 打开串口
        if (!this.openButtonStatus) {
          const port = new SerialPort(this.currentPort, {
            baudRate: 9600,
            autoOpen: false,
          });
          port.open((err) => {
            if (err) {
              this.$message.error(`打开串口${this.currentPort}失败！请检查该串口是否被占用`);
            } else {
              this.openButtonText = '关闭串口';
              this.openButtonStatus = true;
              this.openButtonType = 'success';
            }
          });
          this.port = port;
          const parser = port.pipe(new InterByteTimeout({ interval: 50 }));
          parser.on('data', this.receiveDataProcess);
        } else {
          this.port.close((err) => {
            if (err) {
              this.$message.error(`关闭串口${this.currentPort}失败！`);
            } else {
              this.openButtonText = '打开串口';
              this.openButtonStatus = false;
              this.openButtonType = 'danger';
              this.percentage = 0;
              this.curPkgNum = -1;
              this.sumPkgNum = 0;
              this.binaryData = null;
              this.downloading = false;
            }
          });
        }
      } else if (this.linkType === 2) {
        // 监听tcp端口
        if (!this.openButtonStatus) {
          const server = net.createServer();
          const self = this;
          server.listen(this.socketPort, '0.0.0.0');
          server.on('connection', (socket) => {
            if (self.socket) {
              // 只允许一个socket存在
              socket.end();
            } else {
              self.openButtonText = '断开连接';
              self.openButtonStatus = true;
              self.openButtonType = 'success';
              self.server = server;
              self.socket = socket;
              socket.on('close', () => {
                self.openButtonText = '开始监听';
                self.openButtonStatus = false;
                self.openButtonType = 'danger';
                self.server = null;
                self.socket = null;
                self.percentage = 0;
                self.curPkgNum = -1;
                self.sumPkgNum = 0;
                self.binaryData = null;
                self.downloading = false;
              });
              socket.on('data', this.receiveDataProcess);
            }
          });
        } else {
          this.server.close();
          this.socket.end();
          this.openButtonText = '开始监听';
          this.openButtonStatus = false;
          this.openButtonType = 'danger';
          this.server = null;
          this.socket = null;
        }
      }
    },
    onClearCommunicationInfo() {
      this.textarea = '';
    },
    onDetection() {
      const send = Buffer.alloc(8);
      send[0] = 0x00;
      send[1] = 0x03;
      send[2] = 0x00;
      send[3] = 0x60;
      send[4] = 0x00;
      send[5] = 0x04;
      const checkSum = modbusCrc(send, 0, 6);
      send[6] = checkSum & 0xff;
      send[7] = (checkSum >> 8) & 0xff;
      if (this.linkType === 1) {
        this.port.write(send);
      } else if (this.linkType === 2) {
        this.socket.write(send);
      }
      this.textarea += `发送(HEX): ${send.toString('hex').toUpperCase()}\r\n`;
    },
    onDownload() {
      this.curPkgNum = -1;
      this.downloading = false;
      this.percentage = 0;
      this.progressStatus = 'exception';
      const send = Buffer.alloc(4);
      send[0] = 0x01;
      send[1] = 0xe0;
      const checkSum = modbusCrc(send, 0, 2);
      send[2] = checkSum & 0xff;
      send[3] = (checkSum >> 8) & 0xff;
      this.textarea += `发送(HEX): ${send.toString('hex').toUpperCase()}\r\n`;
      if (this.linkType === 1) {
        this.port.write(send);
      } else if (this.linkType === 2) {
        this.socket.write(send);
      }
    },
    receiveDataProcess(data) {
      const recvLen = data.length;
      if (recvLen === 1) {
        this.textarea += `接收(HEX): ${data.toString('hex').toUpperCase()}\r\n`;
        if (data[0] === 0x43) {
          // 只接收到'C'表明等待发送数据
          this.downloadProcess();
        } else if (data[0] === 0x06 && this.downloading) {
          this.downloadProcess();
        } else if (data[0] === MODEM_NAK && this.downloading) {
          this.curPkgNum--;
          this.downloadProcess();
        }
      } else if (data[0] <= 0x09) {
        if (data[0] === 0x06 && data[1] === 0x43) {
          this.textarea += `接收(HEX): ${data.toString('hex').toUpperCase()}\r\n`;
          // 正确回应信息包 则开始传输数据包
          this.downloading = true;
          this.curPkgNum++;
          this.downloadProcess();
        } else if (data[0] === 0x06 && data[1] === 0x0a) {
          this.textarea += `接收(STR): ${data}\r\n`;
          if (this.linkType === 1) {
            this.port.write('3');
          } else if (this.linkType === 2) {
            this.socket.write('3');
          }
          this.textarea += '发送(STR): 3\r\n';
        } else {
          this.textarea += `接收(HEX): ${data.toString('hex').toUpperCase()}\r\n`;
        }
      } else {
        this.textarea += `接收(STR): ${data}\r\n`;
        if (
          recvLen >= 3
          && data[recvLen - 1] === 0x0a
          && data[recvLen - 2] === 0x0d
          && data[recvLen - 3] === 0x3e
        ) {
          if (!this.downloading) {
            // 选择菜单 发送1准备烧写程序
            if (this.linkType === 1) {
              this.port.write('1');
            } else if (this.linkType === 2) {
              this.socket.write('1');
            }
            this.textarea += '发送(STR): 1\r\n';
          } else {
            // 选择菜单 发送3运行新程序
            if (this.linkType === 1) {
              this.port.write('3');
            } else if (this.linkType === 2) {
              this.socket.write('3');
            }
            this.textarea += '发送(STR): 3\r\n';
          }
        }
      }
    },
    downloadProcess() {
      if (this.curPkgNum === -1) {
        // 发送信息包
        const fileUriArray = this.fileUri.split('\\');
        const fileName = fileUriArray[fileUriArray.length - 1];
        if (this.linkType === 1) {
          this.port.write(firstFrame(fileName, this.binaryData.length));
        } else if (this.linkType === 2) {
          this.socket.write(Buffer.from(firstFrame(fileName, this.binaryData.length)));
        }
      } else if (this.curPkgNum < this.sumPkgNum) {
        // 发送数据包
        if (this.curPkgNum === this.sumPkgNum - 1) {
          // 最后一包
          if (this.linkType === 1) {
            this.port.write(dataFrame(
              this.binaryData,
              128 * this.curPkgNum,
              this.binaryData.length - (128 * this.curPkgNum),
              this.curPkgNum + 1,
            ));
          } else if (this.linkType === 2) {
            this.socket.write(Buffer.from(dataFrame(
              this.binaryData,
              128 * this.curPkgNum,
              this.binaryData.length - (128 * this.curPkgNum),
              this.curPkgNum + 1,
            )));
          }
        } else if (this.linkType === 1) {
          this.port.write(dataFrame(
            this.binaryData,
            128 * this.curPkgNum,
            128,
            this.curPkgNum + 1,
          ));
        } else if (this.linkType === 2) {
          this.socket.write(Buffer.from(dataFrame(
            this.binaryData,
            128 * this.curPkgNum,
            128,
            this.curPkgNum + 1,
          )));
        }
        this.curPkgNum++;
        this.percentage = Math.floor((this.curPkgNum / this.sumPkgNum) * 100);
      } else if (this.curPkgNum === this.sumPkgNum) {
        const send = Buffer.alloc(1);
        send[0] = MODEM_EOT;
        if (this.linkType === 1) {
          this.port.write(send);
        } else if (this.linkType === 2) {
          this.socket.write(send);
        }
        this.textarea += '发送(HEX): 0x04\r\n';
        this.progressStatus = 'success';
        this.curPkgNum++;
      } else if (this.linkType === 1) {
        this.port.write(lastFrame());
      } else if (this.linkType === 2) {
        this.socket.write(Buffer.from(lastFrame()));
      }
    },
  },
  mounted() {
    SerialPort.list().then(
      (ports) => {
        this.portList = [...ports];
        this.currentPort = ports[0].comName;
      },
    );
  },
};
</script>

<style lang="scss">
.communication-setting {
  height: 350px;
  div {
    margin: 2px;
    padding: 2px;
  }
  .el-select {
    padding-left: 0;
    margin-left: 0;
  }
  .el-input {
    width: 100px;
  }
  .el-row {
    height: 50px;
  }
  .communication-setting-open {
    display: flex;
  }
}
.file-select {
  height: 150px;
  .el-input-group__append {
    background-color: #409eff;
    color: white;
  }
}
.download-operation {
  height: 150px;
  .el-progress {
    margin-top: 10px;
  }
}
.communication-info {
  height: 350px;
  .clear-button {
    text-align: right;
  }
  .info-window {
    font-family: 'Courier New', Courier, monospace;
    font-size: 12px;
  }
}
.ant-card {
  margin: 10px;
}
.el-select {
  width: 100px;
}
</style>
