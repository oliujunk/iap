import ElementUI from 'element-ui';
import 'element-ui/lib/theme-chalk/index.css';

import Antd from 'ant-design-vue';
import 'ant-design-vue/dist/antd.css';

import Vue from 'vue';
import App from './App.vue';

Vue.config.productionTip = false;

Vue.use(ElementUI);

Vue.use(Antd);

new Vue({
  render: (h) => h(App),
}).$mount('#app');
