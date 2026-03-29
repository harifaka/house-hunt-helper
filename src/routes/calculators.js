const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { getDb } = require('../database');
const { logger } = require('../logger');

// GET /calculators/energy — Energy calculator page
router.get('/energy', (req, res) => {
  res.render('energy-calculator', {
    pageTitle: res.locals.t.energy_calculator,
    currentPath: '/calculators/energy'
  });
});

// GET /calculators/heating — Heating calculator page
router.get('/heating', async (req, res) => {
  const db = await getDb();
  try {
    const houses = await db.prepare('SELECT id, name FROM houses ORDER BY name').all();
    const templates = await db.prepare('SELECT * FROM window_door_templates ORDER BY is_standard DESC, name').all();
    const savedCalcs = await db.prepare('SELECT id, name, house_id, created_at, updated_at FROM heating_calculations ORDER BY updated_at DESC LIMIT 20').all();
    
    res.render('heating-calculator', {
      pageTitle: res.locals.t.heating_calculator,
      currentPath: '/calculators/heating',
      houses,
      templates,
      savedCalcs
    });
  } finally {
    await db.close();
  }
});

// --- Heating Calculation API ---

// POST /calculators/heating/save — Save a heating calculation
router.post('/heating/save', async (req, res) => {
  const db = await getDb();
  try {
    const { id, name, houseId, parameters, results } = req.body;
    if (!name || !parameters || !results) {
      return res.status(400).json({ error: 'name, parameters, and results are required' });
    }

    const calcId = id || crypto.randomUUID();
    let paramsStr, resultsStr;
    try {
      paramsStr = typeof parameters === 'string' ? parameters : JSON.stringify(parameters);
      resultsStr = typeof results === 'string' ? results : JSON.stringify(results);
    } catch (_e) {
      return res.status(400).json({ error: 'Invalid parameters or results format' });
    }

    // Check if updating existing
    if (id) {
      const existing = await db.prepare('SELECT id FROM heating_calculations WHERE id = ?').get(id);
      if (existing) {
        await db.prepare(
          'UPDATE heating_calculations SET name = ?, house_id = ?, parameters = ?, results = ?, updated_at = ? WHERE id = ?'
        ).run(name, houseId || null, paramsStr, resultsStr, new Date().toISOString(), id);
        
        const meta = { ip: req.ip, ua: (req.headers['user-agent'] || '').substring(0, 255) };
        logger.audit('calculator', 'calculation_updated', { calcId: id, name, houseId }, meta).catch(() => {});
        
        return res.json({ success: true, id });
      }
    }

    await db.prepare(
      'INSERT INTO heating_calculations (id, house_id, name, parameters, results) VALUES (?, ?, ?, ?, ?)'
    ).run(calcId, houseId || null, name, paramsStr, resultsStr);

    const meta = { ip: req.ip, ua: (req.headers['user-agent'] || '').substring(0, 255) };
    logger.audit('calculator', 'calculation_saved', { calcId, name, houseId }, meta).catch(() => {});

    res.json({ success: true, id: calcId });
  } finally {
    await db.close();
  }
});

// GET /calculators/heating/load/:id — Load a saved calculation
router.get('/heating/load/:id', async (req, res) => {
  const db = await getDb();
  try {
    const calc = await db.prepare('SELECT * FROM heating_calculations WHERE id = ?').get(req.params.id);
    if (!calc) return res.status(404).json({ error: 'Calculation not found' });
    
    res.json({
      id: calc.id,
      name: calc.name,
      houseId: calc.house_id,
      parameters: JSON.parse(calc.parameters),
      results: JSON.parse(calc.results),
      createdAt: calc.created_at,
      updatedAt: calc.updated_at
    });
  } finally {
    await db.close();
  }
});

// DELETE /calculators/heating/delete/:id — Delete a saved calculation
router.post('/heating/delete/:id', async (req, res) => {
  const db = await getDb();
  try {
    await db.prepare('DELETE FROM heating_calculations WHERE id = ?').run(req.params.id);
    
    const meta = { ip: req.ip, ua: (req.headers['user-agent'] || '').substring(0, 255) };
    logger.audit('calculator', 'calculation_deleted', { calcId: req.params.id }, meta).catch(() => {});
    
    res.json({ success: true });
  } finally {
    await db.close();
  }
});

// GET /calculators/heating/list — List saved calculations
router.get('/heating/list', async (req, res) => {
  const db = await getDb();
  try {
    const calcs = await db.prepare(
      'SELECT c.id, c.name, c.house_id, c.created_at, c.updated_at, h.name as house_name FROM heating_calculations c LEFT JOIN houses h ON c.house_id = h.id ORDER BY c.updated_at DESC'
    ).all();
    res.json(calcs);
  } finally {
    await db.close();
  }
});

// --- Window/Door Template API ---

// GET /calculators/templates — List all templates
router.get('/templates', async (req, res) => {
  const db = await getDb();
  try {
    const templates = await db.prepare('SELECT * FROM window_door_templates ORDER BY is_standard DESC, name').all();
    res.json(templates);
  } finally {
    await db.close();
  }
});

// POST /calculators/templates — Create a new template
router.post('/templates', async (req, res) => {
  const db = await getDb();
  try {
    const { name, width, height, type, u_value } = req.body;
    if (!name || !width || !height) {
      return res.status(400).json({ error: 'name, width, and height are required' });
    }

    const id = crypto.randomUUID();
    await db.prepare(
      'INSERT INTO window_door_templates (id, name, width, height, type, u_value, is_standard) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, name, parseFloat(width), parseFloat(height), type || 'double', parseFloat(u_value) || 2.8, 0);

    const meta = { ip: req.ip, ua: (req.headers['user-agent'] || '').substring(0, 255) };
    logger.audit('calculator', 'template_created', { templateId: id, name }, meta).catch(() => {});

    res.json({ success: true, id });
  } finally {
    await db.close();
  }
});

// POST /calculators/templates/:id/delete — Delete a template (only non-standard)
router.post('/templates/:id/delete', async (req, res) => {
  const db = await getDb();
  try {
    // Don't allow deleting standard templates
    const template = await db.prepare('SELECT * FROM window_door_templates WHERE id = ?').get(req.params.id);
    if (!template) return res.status(404).json({ error: 'Template not found' });
    if (template.is_standard === 1) return res.status(400).json({ error: 'Cannot delete standard templates' });

    await db.prepare('DELETE FROM window_door_templates WHERE id = ?').run(req.params.id);
    
    const meta = { ip: req.ip, ua: (req.headers['user-agent'] || '').substring(0, 255) };
    logger.audit('calculator', 'template_deleted', { templateId: req.params.id }, meta).catch(() => {});
    
    res.json({ success: true });
  } finally {
    await db.close();
  }
});

module.exports = router;
