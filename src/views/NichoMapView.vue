<script setup>
import { useNicheStore } from '@/stores/Niche'

const nicheStore = useNicheStore()
</script>

<template>
  <section class="niche-map-view">
    <button type="button" @click="nicheStore.clearZone" class="back-button">
      ← Volver al mapa
    </button>
    <h2>{{ nicheStore.selectedZone?.nombre }}</h2>

    <p>
      Zona seleccionada:
      {{ nicheStore.selectedZone?.id }}
    </p>

    <p>Aquí se mostrará el mapa de nichos.</p>
  </section>
</template>

<style scoped>
.niche-map-view {
  width: 100%;
  height: 100%;
  padding: 1rem;
  box-sizing: border-box;
}
</style>
