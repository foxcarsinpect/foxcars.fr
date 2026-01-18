/**
 * FOXCARS Préachat App - Inspection Form JavaScript
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'foxcars_inspection_report';
  const AUTOSAVE_INTERVAL = 3000; // 3 seconds
  let autosaveTimer = null;
  let formData = {};

  // === INITIALIZATION ===
  document.addEventListener('DOMContentLoaded', () => {
    initializeForm();
    setupAutosave();
    setupFormListeners();
    loadSavedData();
    showWelcomeMessage();
  });

  function initializeForm() {
    // Set default date and time
    const now = new Date();
    const dateInput = document.getElementById('inspection-date');
    const timeInput = document.getElementById('inspection-time');

    if (dateInput && !dateInput.value) {
      dateInput.value = now.toISOString().split('T')[0];
    }

    if (timeInput && !timeInput.value) {
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      timeInput.value = `${hours}:${minutes}`;
    }
  }

  function showWelcomeMessage() {
    console.log('%c🦊 FOXCARS Préachat App', 'color: #ff6a00; font-size: 18px; font-weight: bold;');
    console.log('%cRapport d\'inspection automobile', 'color: #ff8533; font-size: 14px;');
    console.log('%c💾 Auto-sauvegarde activée', 'color: #22c55e; font-size: 12px;');
  }

  // === AUTO-SAVE FUNCTIONALITY ===
  function setupAutosave() {
    const form = document.getElementById('inspection-form');
    if (!form) return;

    // Create autosave indicator
    const indicator = document.createElement('div');
    indicator.className = 'autosave-indicator';
    indicator.innerHTML = '<span class="status-text">Sauvegarde automatique</span>';
    document.body.appendChild(indicator);

    // Listen to all form changes
    form.addEventListener('input', () => {
      clearTimeout(autosaveTimer);

      // Show saving indicator
      indicator.classList.add('show', 'saving');
      indicator.querySelector('.status-text').textContent = '💾 Sauvegarde...';

      autosaveTimer = setTimeout(() => {
        saveToLocalStorage();

        // Show saved indicator
        indicator.querySelector('.status-text').textContent = '✓ Sauvegardé';
        indicator.classList.remove('saving');
        indicator.classList.add('saved');

        // Hide after 2 seconds
        setTimeout(() => {
          indicator.classList.remove('show', 'saved');
        }, 2000);
      }, AUTOSAVE_INTERVAL);
    });

    form.addEventListener('change', () => {
      clearTimeout(autosaveTimer);
      saveToLocalStorage();
    });
  }

  function setupFormListeners() {
    // Sync vehicle data between sections
    const vehicleFields = [
      { id: 'vehicle-immat', target: 'cert-immat-a' },
      { id: 'vehicle-vin', target: 'cert-vin' },
      { id: 'vehicle-marque', target: 'cert-marque' },
      { id: 'vehicle-modele', target: 'cert-modele' },
      { id: 'vehicle-energie', target: 'cert-energie' },
      { id: 'vehicle-places', target: 'cert-places' }
    ];

    vehicleFields.forEach(({ id, target }) => {
      const sourceField = document.getElementById(id);
      const targetField = document.getElementById(target);

      if (sourceField && targetField) {
        sourceField.addEventListener('input', (e) => {
          targetField.value = e.target.value;
        });
      }
    });
  }

  // === DATA PERSISTENCE ===
  function saveToLocalStorage() {
    const form = document.getElementById('inspection-form');
    if (!form) return;

    const data = {};
    const formElements = form.elements;

    for (let element of formElements) {
      if (element.name) {
        if (element.type === 'radio' || element.type === 'checkbox') {
          if (element.checked) {
            data[element.name] = element.value;
          }
        } else {
          data[element.name] = element.value;
        }
      }
    }

    data._savedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    formData = data;
  }

  function loadSavedData() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    try {
      const data = JSON.parse(saved);
      formData = data;

      const form = document.getElementById('inspection-form');
      if (!form) return;

      // Restore form values
      for (let key in data) {
        if (key === '_savedAt') continue;

        const elements = form.elements[key];
        if (!elements) continue;

        if (elements.length > 1) {
          // Radio buttons or checkboxes
          for (let element of elements) {
            if (element.value === data[key]) {
              element.checked = true;
            }
          }
        } else if (elements) {
          // Single input
          elements.value = data[key];
        }
      }

      // Show notification
      if (data._savedAt) {
        const savedDate = new Date(data._savedAt);
        const formattedDate = savedDate.toLocaleString('fr-FR');
        showNotification(`Données restaurées (${formattedDate})`, 'success');
      }
    } catch (error) {
      console.error('Error loading saved data:', error);
      showNotification('Erreur lors du chargement des données', 'error');
    }
  }

  // === SAVE / LOAD / CLEAR FUNCTIONS ===
  window.saveReport = function () {
    saveToLocalStorage();
    showNotification('Rapport sauvegardé avec succès!', 'success');
  };

  window.loadReport = function () {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
          loadSavedData();
          showNotification('Rapport chargé avec succès!', 'success');
        } catch (error) {
          console.error('Error loading report:', error);
          showNotification('Erreur lors du chargement du fichier', 'error');
        }
      };
      reader.readAsText(file);
    };

    input.click();
  };

  window.clearForm = function () {
    if (!confirm('Voulez-vous vraiment effacer tous les données et créer un nouveau rapport?')) {
      return;
    }

    const form = document.getElementById('inspection-form');
    if (form) {
      form.reset();
      localStorage.removeItem(STORAGE_KEY);
      formData = {};
      initializeForm();
      showNotification('Nouveau rapport créé', 'success');
    }
  };

  // === PDF GENERATION ===
  window.generatePDF = function () {
    saveToLocalStorage();

    // For now, use the browser's print functionality
    // In the future, integrate with a library like jsPDF or pdfmake
    showNotification('Génération du PDF...', 'success');

    // Add PDF-specific styles
    document.body.classList.add('printing');

    setTimeout(() => {
      window.print();
      document.body.classList.remove('printing');
    }, 500);
  };

  // === EXPORT TO JSON ===
  window.exportToJSON = function () {
    saveToLocalStorage();

    const dataStr = JSON.stringify(formData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `foxcars-inspection-${Date.now()}.json`;
    link.click();

    URL.revokeObjectURL(url);
    showNotification('Rapport exporté en JSON', 'success');
  };

  // === NOTIFICATION SYSTEM ===
  function showNotification(message, type = 'success') {
    // Remove existing notification
    const existing = document.querySelector('.save-status');
    if (existing) {
      existing.remove();
    }

    // Create new notification
    const notification = document.createElement('div');
    notification.className = `save-status ${type}`;

    const icon = type === 'success' ? '✓' : '⚠';
    notification.innerHTML = `<span>${icon}</span><span>${message}</span>`;

    document.body.appendChild(notification);

    // Show notification
    setTimeout(() => {
      notification.classList.add('show');
    }, 100);

    // Hide after 3 seconds
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        notification.remove();
      }, 400);
    }, 3000);
  }

  // === KEYBOARD SHORTCUTS ===
  document.addEventListener('keydown', (e) => {
    // Ctrl+S or Cmd+S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveReport();
    }

    // Ctrl+P or Cmd+P to print/generate PDF
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
      e.preventDefault();
      generatePDF();
    }

    // Ctrl+E or Cmd+E to export JSON
    if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
      e.preventDefault();
      exportToJSON();
    }
  });

  // === FORM VALIDATION ===
  function validateForm() {
    const form = document.getElementById('inspection-form');
    if (!form) return false;

    const requiredFields = [
      'inspection-date',
      'inspection-client',
      'vehicle-immat',
      'vehicle-marque'
    ];

    let isValid = true;
    const missingFields = [];

    for (let fieldId of requiredFields) {
      const field = document.getElementById(fieldId);
      if (field && !field.value.trim()) {
        isValid = false;
        missingFields.push(field.previousElementSibling?.textContent || fieldId);
        field.style.borderColor = '#ef4444';
      } else if (field) {
        field.style.borderColor = '';
      }
    }

    if (!isValid) {
      showNotification(`Champs requis manquants: ${missingFields.join(', ')}`, 'error');
    }

    return isValid;
  }

  // === DATA SUMMARY ===
  window.showDataSummary = function () {
    const summary = {
      'Date': formData['inspection-date'] || 'Non renseigné',
      'Client': formData['inspection-client'] || 'Non renseigné',
      'Immatriculation': formData['vehicle-immat'] || 'Non renseigné',
      'Marque': formData['vehicle-marque'] || 'Non renseigné',
      'Modèle': formData['vehicle-modele'] || 'Non renseigné',
      'Kilométrage': formData['vehicle-km'] || 'Non renseigné'
    };

    console.table(summary);
    console.log('Toutes les données:', formData);
  };

  // === PROGRESSIVE COMPLETION TRACKER ===
  function calculateCompletion() {
    const form = document.getElementById('inspection-form');
    if (!form) return 0;

    const allFields = form.querySelectorAll('input, select, textarea');
    let filledFields = 0;
    let totalFields = allFields.length;

    allFields.forEach(field => {
      if (field.type === 'radio' || field.type === 'checkbox') {
        const name = field.name;
        if (formData[name]) {
          filledFields++;
        }
      } else if (field.value && field.value.trim()) {
        filledFields++;
      }
    });

    return Math.round((filledFields / totalFields) * 100);
  }

  window.showProgress = function () {
    const completion = calculateCompletion();
    showNotification(`Formulaire complété à ${completion}%`, 'success');
  };

  // === EXPORT TO CONSOLE FOR DEBUGGING ===
  window.FOXCARS = {
    saveReport,
    loadReport,
    clearForm,
    generatePDF,
    exportToJSON,
    showDataSummary,
    showProgress,
    getData: () => formData
  };

  console.log('%cCommandes disponibles:', 'color: #ff6a00; font-weight: bold;');
  console.log('FOXCARS.saveReport() - Sauvegarder le rapport');
  console.log('FOXCARS.exportToJSON() - Exporter en JSON');
  console.log('FOXCARS.showDataSummary() - Afficher le résumé');
  console.log('FOXCARS.showProgress() - Afficher la progression');
  console.log('FOXCARS.getData() - Obtenir toutes les données');
})();
