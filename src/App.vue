<template>
  <div id="app">
    <Home></Home>
  </div>
</template>

<script>
import Home from './components/Home.vue';

export default {
  name: 'App',
  components: {
    Home,
  },
};
</script>

<style lang="scss">
#app {
  background-color: #ececec;
  padding: 20px;
  height: 100%;
  padding: 0;
}
</style>
