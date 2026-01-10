// backend/routes/export.js
// API endpoints for data export and import

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const { DataExporter } = require('../services/dataExporter');

// Helper to get data directory from bootstrap file
function getDataDirectory() {
  try {
    const bootstrapPath = path.join(app.getPath('userData'), 'data-location.json');
    if (fs.existsSync(bootstrapPath)) {
      const bootstrap = JSON.parse(fs.readFileSync(bootstrapPath, 'utf-8'));
      return bootstrap.dataDirectory || app.getPath('userData');
    }
  } catch (error) {
    console.error('Error reading data location:', error);
  }
  return app.getPath('userData');
}

// Get export statistics
router.get('/stats', async (req, res) => {
  try {
    const exporter = new DataExporter(req.db);
    const stats = await exporter.getExportStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting export stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export data to JSON
router.post('/json', async (req, res) => {
  try {
    const exporter = new DataExporter(req.db);
    const dataDirectory = getDataDirectory();
    const exportDir = path.join(dataDirectory, 'exports');
    
    // Ensure export directory exists
    const fs = require('fs');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const outputPath = path.join(exportDir, `vantage-export-${timestamp}.json`);
    
    const stats = await exporter.exportToJSON(outputPath);
    
    res.json({ 
      success: true, 
      path: outputPath,
      stats
    });
  } catch (error) {
    console.error('Error exporting JSON:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export runs to CSV
router.post('/csv', async (req, res) => {
  try {
    const exporter = new DataExporter(req.db);
    const dataDirectory = getDataDirectory();
    const exportDir = path.join(dataDirectory, 'exports');
    
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const outputPath = path.join(exportDir, `vantage-runs-${timestamp}.csv`);
    
    const stats = await exporter.exportRunsToCSV(outputPath);
    
    res.json({ 
      success: true, 
      path: outputPath,
      stats
    });
  } catch (error) {
    console.error('Error exporting CSV:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export date range
router.post('/range', async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate required' });
    }
    
    const exporter = new DataExporter(req.db);
    const dataDirectory = getDataDirectory();
    const exportDir = path.join(dataDirectory, 'exports');
    
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const outputPath = path.join(exportDir, `vantage-range-${timestamp}.json`);
    
    const stats = await exporter.exportDateRange(startDate, endDate, outputPath);
    
    res.json({ 
      success: true, 
      path: outputPath,
      stats
    });
  } catch (error) {
    console.error('Error exporting date range:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
