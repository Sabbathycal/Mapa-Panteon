<script setup>
import TopBar from './TopBar.vue'
import Sidebar from './SideBar.vue'
</script>

<template>
    <div class="app-layout">
        <TopBar />

        <div class="app-content">
            <main class="main-content">
                <RouterView />
            </main>

            <Sidebar />
        </div>
    </div>
</template>

<style scoped>
.app-layout {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
}

.app-content {
    flex: 1;
    display: flex;
    min-height: 0;
}

.main-content {
    flex: 1;
    min-width: 0;
}
</style>