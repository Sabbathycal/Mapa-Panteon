import { createRouter, createWebHistory } from 'vue-router'
import MapView from '../views/MapView.vue'

const routes = [
  {
    path: '/',
    name: 'map',
    component: MapView,
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

export default router
