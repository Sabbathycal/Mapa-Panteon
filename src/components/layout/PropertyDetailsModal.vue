<script setup>
defineProps({
  property: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['close'])
</script>

<template>
  <Teleport to="body">
    <div class="modal-backdrop" @click.self="emit('close')">
      <section
        class="property-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="property-modal-title"
      >
        <header class="modal-header">
          <h2 id="property-modal-title">Ficha de propiedad</h2>

          <button type="button" class="close-modal-button" @click="emit('close')">Cerrar</button>
        </header>

        <div class="modal-content">
          <!-- Lote -->
          <template v-if="property.tipo === 'lote'">
            <h3>
              {{ property.seccionId }} / Manzana {{ property.manzanaId }} / Lote {{ property.lote }}
            </h3>

            <p class="property-id">{{ property.codigo }}</p>

            <dl class="property-data">
              <div>
                <dt>Tipo:</dt>
                <dd>Lote</dd>
              </div>

              <div>
                <dt>Sección:</dt>
                <dd>{{ property.seccionId }}</dd>
              </div>

              <div>
                <dt>Manzana:</dt>
                <dd>{{ property.manzanaId }}</dd>
              </div>

              <div>
                <dt>Código:</dt>
                <dd>{{ property.lote }}</dd>
              </div>

              <div>
                <dt>Estado de venta:</dt>
                <dd>{{ property.estatus_venta || '-' }}</dd>
              </div>

              <div>
                <dt>Estado de ocupación:</dt>
                <dd>{{ property.estatus_ocupacion || '-' }}</dd>
              </div>

              <div>
                <dt>Referencia ProCaP:</dt>
                <dd>{{ property.referencia_procap || '-' }}</dd>
              </div>

              <div>
                <dt>Observaciones:</dt>
                <dd>{{ property.observaciones || '-' }}</dd>
              </div>
            </dl>
          </template>

          <!-- Nicho -->
          <template v-else-if="property.tipo === 'nicho'">
            <h3>{{ property.zonaId }} / {{ property.cara }} / Nicho {{ property.codigo }}</h3>

            <p class="property-id">{{ property.id }}</p>

            <dl class="property-data">
              <div>
                <dt>Tipo:</dt>
                <dd>Nicho</dd>
              </div>

              <div>
                <dt>Zona:</dt>
                <dd>{{ property.zonaId }}</dd>
              </div>

              <div>
                <dt>Cara:</dt>
                <dd>{{ property.cara }}</dd>
              </div>

              <div>
                <dt>Fila:</dt>
                <dd>{{ property.fila }}</dd>
              </div>

              <div>
                <dt>Número:</dt>
                <dd>{{ property.numero }}</dd>
              </div>

              <div>
                <dt>Código:</dt>
                <dd>{{ property.codigo }}</dd>
              </div>

              <div>
                <dt>Estado de venta:</dt>
                <dd>{{ property.estatus_venta || '-' }}</dd>
              </div>

              <div>
                <dt>Estado de ocupación:</dt>
                <dd>{{ property.estatus_ocupacion || '-' }}</dd>
              </div>

              <div>
                <dt>Referencia ProCaP:</dt>
                <dd>{{ property.referencia_procap || '-' }}</dd>
              </div>

              <div>
                <dt>Observaciones:</dt>
                <dd>{{ property.observaciones || '-' }}</dd>
              </div>
            </dl>
          </template>

          <button type="button" class="return-button" @click="emit('close')">
            Volver al resumen
          </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 3000;

  display: grid;
  place-items: center;
  padding: 1rem;

  background-color: rgb(0 0 0 / 55%);
  backdrop-filter: blur(3px);
}

.property-modal {
  width: min(780px, 100%);
  max-height: calc(100vh - 2rem);
  overflow-y: auto;

  border: 1px solid var(--color-border);
  border-radius: 18px;

  background-color: var(--color-background);
  color: var(--color-text);

  box-shadow: 0 20px 50px rgb(0 0 0 / 30%);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;

  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--color-border);
  background-color: var(--color-sidebar);
}

.modal-header h2 {
  margin: 0;
  font-size: 1.2rem;
}

.close-modal-button,
.return-button {
  padding: 0.55rem 0.8rem;

  border: 1px solid var(--color-border);
  border-radius: 10px;

  background-color: var(--color-primary);
  color: white;

  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.modal-content {
  padding: 1.25rem;
}

.modal-content h3 {
  margin: 0;
  font-size: 1.1rem;
}

.property-id {
  margin: 0.3rem 0 1.2rem;
  color: var(--color-text-muted, var(--color-text));
  font-size: 0.8rem;
}

.property-data {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  margin: 0;
}

.property-data div {
  display: flex;
  gap: 0.35rem;
}

.property-data dt {
  font-weight: 700;
}

.property-data dd {
  margin: 0;
  overflow-wrap: anywhere;
}

.return-button {
  width: 100%;
  margin-top: 1.25rem;
}

.return-button:hover {
  filter: brightness(1.5);
}

.close-modal-button:hover {
  filter: brightness(1.5);
}
</style>
