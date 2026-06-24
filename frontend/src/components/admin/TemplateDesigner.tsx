'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, Download } from 'lucide-react';
import toast from 'react-hot-toast';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const PRESET_TEMPLATES = [
  {
    id: 'classic-4x6',
    name: 'Classic 4x6',
    width: 1200,
    height: 1800,
    layout: 'single',
    elements: [],
  },
  {
    id: 'grid-2x2',
    name: '2x2 Grid',
    width: 1200,
    height: 1200,
    layout: 'grid-2x2',
    elements: [],
  },
  {
    id: 'header-footer',
    name: 'Header & Footer',
    width: 1200,
    height: 900,
    layout: 'header-footer',
    elements: [
      { type: 'text', x: 600, y: 100, text: 'Event Name', size: 48, color: '#ffffff' },
      { type: 'text', x: 600, y: 800, text: 'Date & Location', size: 24, color: '#cccccc' },
    ],
  },
  {
    id: 'wedding',
    name: 'Wedding',
    width: 1200,
    height: 1200,
    layout: 'custom',
    elements: [
      { type: 'rect', x: 0, y: 0, width: 1200, height: 200, color: '#8B4513', opacity: 0.3 },
      { type: 'text', x: 600, y: 100, text: 'Our Special Day', size: 48, color: '#ffffff', align: 'center' },
      { type: 'line', x1: 100, y1: 200, x2: 1100, y2: 200, color: '#FFD700', width: 3 },
    ],
  },
  {
    id: 'birthday',
    name: 'Birthday Party',
    width: 1200,
    height: 1200,
    layout: 'custom',
    elements: [
      { type: 'text', x: 600, y: 80, text: '🎉 Happy Birthday! 🎉', size: 44, color: '#FF69B4', align: 'center' },
      { type: 'rect', x: 50, y: 150, width: 1100, height: 950, color: '#FFB6C1', opacity: 0.2 },
    ],
  },
];

export function TemplateDesigner({ event, onTemplateSelect }: any) {
  const [templates, setTemplates] = useState(PRESET_TEMPLATES);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(PRESET_TEMPLATES[0]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingElement, setEditingElement] = useState<any>(null);

  function handleTemplateSelect(template: any) {
    setSelectedTemplate(template);
    onTemplateSelect(template);
    toast.success(`Selected: ${template.name}`);
  }

  function addElement(type: string) {
    const newElement = {
      id: `element-${Date.now()}`,
      type,
      x: 100,
      y: 100,
      ...(type === 'text' && { text: 'New Text', size: 24, color: '#ffffff' }),
      ...(type === 'rect' && { width: 200, height: 200, color: '#8B5CF6', opacity: 0.5 }),
      ...(type === 'image' && { width: 400, height: 400, url: '' }),
    };

    setSelectedTemplate({
      ...selectedTemplate,
      elements: [...(selectedTemplate.elements || []), newElement],
    });
  }

  function updateElement(elementId: string, updates: any) {
    setSelectedTemplate({
      ...selectedTemplate,
      elements: selectedTemplate.elements.map((el: any) =>
        el.id === elementId ? { ...el, ...updates } : el
      ),
    });
  }

  function deleteElement(elementId: string) {
    setSelectedTemplate({
      ...selectedTemplate,
      elements: selectedTemplate.elements.filter((el: any) => el.id !== elementId),
    });
  }

  async function saveTemplate() {
    try {
      if (!selectedTemplate.name) {
        toast.error('Please name your template');
        return;
      }

      const response = await fetch(`${API_BASE}/api/events/${event.id}/templates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('sb_access_token')}`,
        },
        body: JSON.stringify(selectedTemplate),
      });

      if (!response.ok) throw new Error('Failed to save template');

      toast.success('Template saved successfully!');
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  return (
    <div className="space-y-6">
      {/* Template Preview */}
      <div className="bg-[#0d0d1a] border border-white/10 rounded-2xl p-6">
        <h3 className="text-white font-bold text-lg mb-4">Template Preview</h3>
        <div className="bg-black rounded-lg overflow-hidden flex items-center justify-center" style={{ aspectRatio: selectedTemplate.width / selectedTemplate.height }}>
          <svg
            width={Math.min(selectedTemplate.width / 2, 400)}
            height={Math.min(selectedTemplate.height / 2, 400)}
            viewBox={`0 0 ${selectedTemplate.width} ${selectedTemplate.height}`}
            className="bg-white/5"
          >
            {/* Render template elements */}
            {selectedTemplate.elements?.map((el: any) => (
              <g key={el.id}>
                {el.type === 'rect' && (
                  <rect
                    x={el.x}
                    y={el.y}
                    width={el.width}
                    height={el.height}
                    fill={el.color}
                    opacity={el.opacity || 1}
                  />
                )}
                {el.type === 'text' && (
                  <text
                    x={el.x}
                    y={el.y}
                    fontSize={el.size}
                    fill={el.color}
                    textAnchor={el.align === 'center' ? 'middle' : 'start'}
                  >
                    {el.text}
                  </text>
                )}
                {el.type === 'line' && (
                  <line
                    x1={el.x1}
                    y1={el.y1}
                    x2={el.x2}
                    y2={el.y2}
                    stroke={el.color}
                    strokeWidth={el.width || 2}
                  />
                )}
              </g>
            ))}
          </svg>
        </div>
      </div>

      {/* Preset Templates */}
      <div className="bg-[#0d0d1a] border border-white/10 rounded-2xl p-6">
        <h3 className="text-white font-bold text-lg mb-4">Preset Templates</h3>
        <div className="grid grid-cols-2 gap-3">
          {PRESET_TEMPLATES.map(template => (
            <motion.button
              key={template.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleTemplateSelect(template)}
              className={`p-3 rounded-lg border-2 transition-all text-left ${
                selectedTemplate.id === template.id
                  ? 'border-violet-400 bg-violet-500/10'
                  : 'border-white/10 hover:border-white/30 bg-white/5'
              }`}
            >
              <p className="text-white font-semibold text-sm">{template.name}</p>
              <p className="text-white/50 text-xs">
                {template.width}x{template.height}
              </p>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Element Editor */}
      <div className="bg-[#0d0d1a] border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold text-lg">Design Elements</h3>
          <div className="flex gap-2">
            <button
              onClick={() => addElement('text')}
              className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> Text
            </button>
            <button
              onClick={() => addElement('rect')}
              className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> Shape
            </button>
          </div>
        </div>

        {selectedTemplate.elements?.map((el: any) => (
          <div key={el.id} className="mb-3 p-3 bg-white/5 rounded-lg border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white text-sm font-semibold capitalize">{el.type}</span>
              <button
                onClick={() => deleteElement(el.id)}
                className="text-red-400 hover:text-red-300 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {el.type === 'text' && (
              <div className="space-y-2">
                <input
                  type="text"
                  value={el.text}
                  onChange={e => updateElement(el.id, { text: e.target.value })}
                  className="w-full px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm"
                  placeholder="Text content"
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={el.size}
                    onChange={e => updateElement(el.id, { size: Number(e.target.value) })}
                    className="w-20 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm"
                    placeholder="Size"
                  />
                  <input
                    type="color"
                    value={el.color}
                    onChange={e => updateElement(el.id, { color: e.target.value })}
                    className="w-12 h-8 rounded cursor-pointer"
                  />
                </div>
              </div>
            )}

            {el.type === 'rect' && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={el.width}
                    onChange={e => updateElement(el.id, { width: Number(e.target.value) })}
                    className="w-24 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm"
                    placeholder="Width"
                  />
                  <input
                    type="number"
                    value={el.height}
                    onChange={e => updateElement(el.id, { height: Number(e.target.value) })}
                    className="w-24 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm"
                    placeholder="Height"
                  />
                </div>
                <input
                  type="color"
                  value={el.color}
                  onChange={e => updateElement(el.id, { color: e.target.value })}
                  className="w-12 h-8 rounded cursor-pointer"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Save Button */}
      <button
        onClick={saveTemplate}
        className="w-full px-4 py-3 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-lg flex items-center justify-center gap-2"
      >
        <Download className="w-5 h-5" />
        Save Template
      </button>
    </div>
  );
}
