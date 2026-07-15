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
        <p>Selecciona un elemento del mapa.</p>
    </aside>
</template>

<style scoped>
.sidebar {
    width:320px;
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
    border-radius: 15%;
}
</style>