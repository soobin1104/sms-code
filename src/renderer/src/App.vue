<template>
  <div>
    <button @click="fetchVerificationCode">获取验证码</button>
    <p>最新验证码: {{ verificationCode }}</p>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const verificationCode = ref('')

async function fetchVerificationCode() {
  verificationCode.value = await window.electron.ipcRenderer.invoke('fetch-code')
}
</script>
