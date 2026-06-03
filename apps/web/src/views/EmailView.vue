<template>
  <div class="email-view container">
    <h1 class="text-2xl font-display">EMAIL</h1>
    <p class="text-muted">Internal messaging system</p>
    
    <div class="card mt-xl">
      <div class="card-header"><h3>Email System</h3></div>
      <div class="card-body">
        <p>Internal email functionality is being migrated to Supabase Edge Functions.</p>
        <p class="text-muted">Use the email edge functions for sending and receiving messages.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts"></script>

<style scoped>
.email-view { padding: var(--spacing-xl) 0; }
.mt-xl { margin-top: var(--spacing-xl); }
</style>