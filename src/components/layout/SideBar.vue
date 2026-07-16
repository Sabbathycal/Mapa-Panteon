<script setup>
import { useSelectionStore } from '@/stores/Selection';

const selectionStore = useSelectionStore()
</script>

<template>
    <aside class="sidebar">
        <button
            v-if="selectionStore.canGoBack"
            type="button"
            class="back-button"
            @click="selectionStore.goBack"
        >
        ← Volver
        </button>

        <div v-if="selectionStore.selectedLotId" class="selection-details">
            <label> Seccion: 
                <input :value="selectionStore.selectedSectionId"
                        type="text" readonly/>
            </label>

            <label> Manzana: 
                <input :value="selectionStore.selectedBlockId"
                        type="text" readonly/>
            </label>

            <label> Lote: 
                <input :value="selectionStore.selectedLotId"
                        type="text" readonly/>
            </label>
        </div>

        <p>Selecciona un elemento del mapa.</p>
    </aside>
</template>

<style scoped>
.sidebar {
    width:280px;
    padding: 1rem;
    border-left: 1px solid var(--color-border);
    background-color: var(--color-sidebar);
    
}

.back-button {
    background-color: var(--color-backbutton);
    color: white;
    font-size: medium;
    font-weight: bold;
    padding: 5px;
    border-radius: 10%;
}

.selection-details{
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
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background-color: var(--color-background);
    color: var(--color-text);
    box-sizing: border-box;
}

</style>