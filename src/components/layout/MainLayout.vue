<script setup>
import TopBar from './TopBar.vue'
import Sidebar from './SideBar.vue'
import AdminToolbar from '../admin/AdminToolbar.vue'
</script>

<template>
  <div class="app-layout">
    <TopBar />

    <div class="app-content">
      <AdminToolbar />

      <main class="main-content">
        <RouterView />
      </main>

      <Sidebar />
    </div>
  </div>
</template>

<style scoped>
.app-layout {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.app-content {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

.main-content {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}
</style>
