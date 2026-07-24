<script setup>
import { computed } from 'vue'
import { useSelectionStore } from '@/stores/Selection'
import { LotService } from '@/services/lot/LotService'

const selectionStore = useSelectionStore()

const selectedLot = computed(() => {
  if (!selectionStore.selectedLotId) {
    return null
  }

  return LotService.getLotbyId(
    selectionStore.selectedLotId,
    selectionStore.selectedSectionId,
    selectionStore.selectedBlockId,
    selectionStore.selectedLotStatus,
  )
})
</script>

<template>
  <div class="info-sidebar">
    <button
      v-if="selectionStore.canGoBack"
      type="button"
      class="back-button"
      @click="selectionStore.goBack"
    >
      ← Volver
    </button>

    <div v-if="selectedLot" class="selection-details">
      <label>
        Sección:
        <input :value="selectedLot.section" readonly />
      </label>

      <label>
        Manzana:
        <input :value="selectedLot.block" readonly />
      </label>

      <label>
        Lote:
        <input :value="selectedLot.id" readonly />
      </label>

      <label>
        Propietario:
        <input :value="selectedLot.owner" readonly />
      </label>

      <label>
        Estado:
        <input :value="selectedLot.status" readonly />
      </label>

      <label>
        Paquete:
        <input :value="selectedLot.package" readonly />
      </label>
    </div>

    <p v-else>Haz clic en cualquier elemento del mapa.</p>
  </div>
</template>

<style scoped>
.info-sidebar {
  width: 100%;
  height: 100%;
}

.selection-details {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-top: 10px;
}

.selection-details label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-weight: 600;
}

.selection-details input {
  width: 100%;
  padding: 0.6rem;
  box-sizing: border-box;

  border: 1px solid var(--color-border);
  border-radius: 4px;
  background-color: var(--color-background);
  color: var(--color-text);
}
</style>
