import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

import { useInventoryStore } from './stores/Inventory.js'

import './styles/variables.css'
import './styles/reset.css'
import './styles/global.css'
import './styles/leaflet.css'

const app = createApp(App)

const pinia = createPinia()

app.use(pinia)
app.use(router)

const inventoryStore = useInventoryStore(pinia)

inventoryStore.loadInventory().catch((error) => {
  console.error('[Inventory] Falló la carga inicial:', error)
})

app.mount('#app')
