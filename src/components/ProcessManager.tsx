import React, { useEffect, useState } from 'react';
import { collection, query, addDoc, getDocs, deleteDoc, doc, orderBy, writeBatch, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Process, Step } from '../types';
import { Plus, Trash2, Edit2, ChevronRight, Save, X, GripVertical, Info, ClipboardList, Settings as SettingsIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function ProcessManager() {
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingProcess, setIsAddingProcess] = useState(false);
  const [selectedProcess, setSelectedProcess] = useState<Process | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [selectedStep, setSelectedStep] = useState<Step | null>(null);
  const [subSteps, setSubSteps] = useState<Step[]>([]);
  
  // Form States
  const [newProcess, setNewProcess] = useState({ name: '', sector: '', origin: '', function: '' });
  const [newStepName, setNewStepName] = useState('');
  const [newSubStepName, setNewSubStepName] = useState('');
  
  // Edit States
  const [editingProcess, setEditingProcess] = useState<Process | null>(null);
  const [editingStep, setEditingStep] = useState<{ id: string, name: string } | null>(null);
  const [editingSubStep, setEditingSubStep] = useState<{ id: string, name: string } | null>(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    fetchProcesses();
  }, []);

  async function fetchProcesses() {
    setLoading(true);
    try {
      const q = query(collection(db, 'processes'), orderBy('order', 'asc'));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Process));
      setProcesses(data);
    } catch (error) {
      console.error('Error fetching processes:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchSteps(processId: string) {
    try {
      const q = query(collection(db, `processes/${processId}/steps`), orderBy('order', 'asc'));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Step));
      setSteps(data);
      setSelectedStep(null);
      setSubSteps([]);
    } catch (error) {
      console.error('Error fetching steps:', error);
    }
  }

  async function fetchSubSteps(processId: string, stepId: string) {
    try {
      const q = query(collection(db, `processes/${processId}/steps/${stepId}/substeps`), orderBy('order', 'asc'));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Step));
      setSubSteps(data);
    } catch (error) {
      console.error('Error fetching sub-steps:', error);
    }
  }

  const handleAddProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'processes'), {
        ...newProcess,
        createdAt: new Date().toISOString()
      });
      setIsAddingProcess(false);
      setNewProcess({ name: '', sector: '', origin: '', function: '' });
      fetchProcesses();
    } catch (error) {
      console.error('Error adding process:', error);
    }
  };

  const handleAddStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProcess || !newStepName.trim()) return;

    try {
      const nextOrder = steps.length > 0 ? Math.max(...steps.map(s => s.order)) + 1 : 0;
      await addDoc(collection(db, `processes/${selectedProcess.id}/steps`), {
        processId: selectedProcess.id,
        name: newStepName,
        order: nextOrder,
        isHeading: false
      });
      setNewStepName('');
      fetchSteps(selectedProcess.id);
    } catch (error) {
      console.error('Error adding step:', error);
    }
  };

  const handleAddSubStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProcess || !selectedStep || !newSubStepName.trim()) return;

    try {
      const nextOrder = subSteps.length > 0 ? Math.max(...subSteps.map(s => s.order)) + 1 : 0;
      await addDoc(collection(db, `processes/${selectedProcess.id}/steps/${selectedStep.id}/substeps`), {
        processId: selectedProcess.id,
        name: newSubStepName,
        order: nextOrder
      });
      
      // Update parent step if it wasn't a heading yet
      if (!selectedStep.isHeading) {
        await updateDoc(doc(db, `processes/${selectedProcess.id}/steps`, selectedStep.id), {
          isHeading: true
        });
        setSelectedStep({ ...selectedStep, isHeading: true });
      }

      setNewSubStepName('');
      fetchSubSteps(selectedProcess.id, selectedStep.id);
    } catch (error) {
      console.error('Error adding sub-step:', error);
    }
  };

  const handleDeleteProcess = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este processo? Todos os passos serão removidos.')) return;
    try {
      await deleteDoc(doc(db, 'processes', id));
      if (selectedProcess?.id === id) {
        setSelectedProcess(null);
        setSteps([]);
      }
      fetchProcesses();
    } catch (error) {
      console.error('Error deleting process:', error);
    }
  };

  const handleDeleteStep = async (stepId: string) => {
    if (!selectedProcess) return;
    try {
      await deleteDoc(doc(db, `processes/${selectedProcess.id}/steps`, stepId));
      fetchSteps(selectedProcess.id);
    } catch (error) {
      console.error('Error deleting step:', error);
    }
  };

  const handleDeleteSubStep = async (subStepId: string) => {
    if (!selectedProcess || !selectedStep) return;
    try {
      await deleteDoc(doc(db, `processes/${selectedProcess.id}/steps/${selectedStep.id}/substeps`, subStepId));
      fetchSubSteps(selectedProcess.id, selectedStep.id);
    } catch (error) {
      console.error('Error deleting sub-step:', error);
    }
  };

  const handleUpdateProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProcess) return;
    try {
      await updateDoc(doc(db, 'processes', editingProcess.id), {
        name: editingProcess.name,
        sector: editingProcess.sector,
        origin: editingProcess.origin,
        function: editingProcess.function
      });
      setEditingProcess(null);
      fetchProcesses();
    } catch (error) {
      console.error('Error updating process:', error);
    }
  };

  const handleUpdateStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProcess || !editingStep) return;
    try {
      await updateDoc(doc(db, `processes/${selectedProcess.id}/steps`, editingStep.id), {
        name: editValue
      });
      setEditingStep(null);
      setEditValue('');
      fetchSteps(selectedProcess.id);
    } catch (error) {
      console.error('Error updating step:', error);
    }
  };

  const handleUpdateSubStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProcess || !selectedStep || !editingSubStep) return;
    try {
      await updateDoc(doc(db, `processes/${selectedProcess.id}/steps/${selectedStep.id}/substeps`, editingSubStep.id), {
        name: editValue
      });
      setEditingSubStep(null);
      setEditValue('');
      fetchSubSteps(selectedProcess.id, selectedStep.id);
    } catch (error) {
      console.error('Error updating sub-step:', error);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Process List */}
      <div className="lg:col-span-1 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold text-gray-900">Processos</h2>
          <button
            onClick={() => setIsAddingProcess(true)}
            className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {isAddingProcess && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-4 rounded-xl border border-red-200 shadow-sm"
          >
            <form onSubmit={handleAddProcess} className="space-y-3">
              <input
                autoFocus
                placeholder="Nome do Processo"
                value={newProcess.name}
                onChange={e => setNewProcess({ ...newProcess, name: e.target.value })}
                className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-red-500"
                required
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  placeholder="Setor"
                  value={newProcess.sector}
                  onChange={e => setNewProcess({ ...newProcess, sector: e.target.value })}
                  className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-red-500"
                  required
                />
                <input
                  placeholder="Origem"
                  value={newProcess.origin}
                  onChange={e => setNewProcess({ ...newProcess, origin: e.target.value })}
                  className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-red-500"
                  required
                />
              </div>
              <input
                placeholder="Função (ex: Empilhador)"
                value={newProcess.function}
                onChange={e => setNewProcess({ ...newProcess, function: e.target.value })}
                className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-red-500"
                required
              />
              <div className="flex gap-2">
                <button type="submit" className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors">
                  Salvar
                </button>
                <button type="button" onClick={() => setIsAddingProcess(false)} className="px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            </form>
          </motion.div>
        )}

        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {processes.map(p => (
            <div key={p.id}>
              {editingProcess?.id === p.id ? (
                <div className="bg-white p-4 rounded-xl border border-red-200 shadow-md">
                  <form onSubmit={handleUpdateProcess} className="space-y-3">
                    <input
                      autoFocus
                      placeholder="Nome do Processo"
                      value={editingProcess.name}
                      onChange={e => setEditingProcess({ ...editingProcess, name: e.target.value })}
                      className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-red-500"
                      required
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        placeholder="Setor"
                        value={editingProcess.sector}
                        onChange={e => setEditingProcess({ ...editingProcess, sector: e.target.value })}
                        className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-red-500"
                        required
                      />
                      <input
                        placeholder="Origem"
                        value={editingProcess.origin}
                        onChange={e => setEditingProcess({ ...editingProcess, origin: e.target.value })}
                        className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-red-500"
                        required
                      />
                    </div>
                    <input
                      placeholder="Função"
                      value={editingProcess.function}
                      onChange={e => setEditingProcess({ ...editingProcess, function: e.target.value })}
                      className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-red-500"
                      required
                    />
                    <div className="flex gap-2">
                      <button type="submit" className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors">
                        Atualizar
                      </button>
                      <button type="button" onClick={() => setEditingProcess(null)} className="px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">
                        <X className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div
                  onClick={() => {
                    setSelectedProcess(p);
                    fetchSteps(p.id);
                  }}
                  className={`group flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${
                    selectedProcess?.id === p.id
                      ? 'bg-red-50 border-red-200 shadow-sm'
                      : 'bg-white border-gray-100 hover:border-red-200'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-bold transition-colors truncate ${selectedProcess?.id === p.id ? 'text-red-700' : 'text-gray-900 group-hover:text-red-600'}`}>
                      {p.name}
                    </h3>
                    <p className="text-xs text-gray-500">{p.sector} • {p.function}</p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingProcess(p); }}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-white rounded-lg"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteProcess(p.id); }}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-white rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <ChevronRight className={`w-4 h-4 text-gray-400 ${selectedProcess?.id === p.id ? 'rotate-90' : ''}`} />
                  </div>
                </div>
              )}
            </div>
          ))}
          {!loading && processes.length === 0 && (
            <p className="text-center text-gray-500 py-10">Nenhum processo cadastrado.</p>
          )}
        </div>
      </div>

      {/* Step Editor */}
      <div className="lg:col-span-2">
        <AnimatePresence mode="wait">
          {selectedProcess ? (
            <motion.div
              key={selectedProcess.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white border border-gray-200 rounded-3xl p-6 md:p-8 min-h-[400px] flex flex-col shadow-sm"
            >
              <div className="flex items-start justify-between mb-8">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">{selectedProcess.name}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-sm font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded uppercase tracking-wider">{selectedProcess.sector}</span>
                    <span className="text-sm text-gray-400">|</span>
                    <span className="text-sm text-gray-500">{selectedProcess.function}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                   <div className="bg-gray-50 px-3 py-1 rounded-full border border-gray-100 text-xs font-medium text-gray-500">
                    ID: {selectedProcess.id.slice(0, 8)}
                  </div>
                </div>
              </div>

              <div className="flex-1 space-y-6">
                <div className="space-y-4">
                  <h4 className="font-bold text-gray-900 flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-red-600" />
                    Atividades e Sub-passos
                  </h4>
                  
                  <div className="space-y-4">
                    {steps.map((step, idx) => (
                      <div key={step.id} className="space-y-2">
                        <motion.div
                          layout
                          onClick={() => {
                            setSelectedStep(step);
                            fetchSubSteps(selectedProcess.id, step.id);
                          }}
                          className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                            selectedStep?.id === step.id 
                            ? 'bg-red-50 border-red-300 shadow-md ring-2 ring-red-100' 
                            : 'bg-gray-50 border-gray-100 hover:border-red-200'
                          }`}
                        >
                          <div className={`flex items-center justify-center w-8 h-8 rounded-lg font-bold text-sm transition-colors ${
                             selectedStep?.id === step.id ? 'bg-red-600 text-white' : 'bg-white border border-gray-200 text-gray-400'
                          }`}>
                            {idx + 1}
                          </div>
                          {editingStep?.id === step.id ? (
                            <form onSubmit={handleUpdateStep} className="flex-1 flex gap-2" onClick={e => e.stopPropagation()}>
                              <input
                                autoFocus
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                className="flex-1 p-1 border-b border-red-500 bg-transparent outline-none font-bold text-red-900"
                              />
                              <button type="submit" className="text-green-600"><Save className="w-4 h-4" /></button>
                              <button type="button" onClick={() => setEditingStep(null)} className="text-gray-400"><X className="w-4 h-4" /></button>
                            </form>
                          ) : (
                            <span className={`flex-1 font-bold ${selectedStep?.id === step.id ? 'text-red-900' : 'text-gray-700'}`}>
                              {step.name}
                            </span>
                          )}
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                setEditingStep({ id: step.id, name: step.name }); 
                                setEditValue(step.name);
                              }}
                              className="p-2 text-gray-400 hover:text-red-600"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <span className="text-[10px] font-bold text-gray-400 uppercase bg-gray-100 px-1.5 py-0.5 rounded">
                              {subSteps.length && selectedStep?.id === step.id ? `${subSteps.length} sub-passos` : step.isHeading ? 'Macro' : 'Simples'}
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteStep(step.id); }}
                              className="p-2 text-gray-400 hover:text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </motion.div>

                        <AnimatePresence>
                          {selectedStep?.id === step.id && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="ml-8 space-y-2 border-l-2 border-red-100 pl-4 py-2"
                            >
                              {subSteps.map((sub, sIdx) => (
                                <div key={sub.id} className="flex items-center gap-2 p-2 bg-white border border-gray-100 rounded-lg group shadow-sm">
                                  <span className="text-[10px] font-bold text-gray-400 w-4">{sIdx + 1}</span>
                                  {editingSubStep?.id === sub.id ? (
                                    <form onSubmit={handleUpdateSubStep} className="flex-1 flex gap-2">
                                      <input
                                        autoFocus
                                        value={editValue}
                                        onChange={e => setEditValue(e.target.value)}
                                        className="flex-1 p-0.5 border-b border-red-500 bg-transparent outline-none text-sm"
                                      />
                                      <button type="submit" className="text-green-600"><Save className="w-3.5 h-3.5" /></button>
                                      <button type="button" onClick={() => setEditingSubStep(null)} className="text-gray-400"><X className="w-3.5 h-3.5" /></button>
                                    </form>
                                  ) : (
                                    <span className="flex-1 text-sm text-gray-600">{sub.name}</span>
                                  )}
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                      onClick={() => {
                                        setEditingSubStep({ id: sub.id, name: sub.name });
                                        setEditValue(sub.name);
                                      }} 
                                      className="p-1 text-gray-300 hover:text-red-500"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => handleDeleteSubStep(sub.id)} className="p-1 text-gray-300 hover:text-red-500">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                              
                              <form onSubmit={handleAddSubStep} className="flex gap-2 pt-2">
                                <input
                                  placeholder="Novo sub-passo (ex: Detalhe técnico)"
                                  value={newSubStepName}
                                  onChange={e => setNewSubStepName(e.target.value)}
                                  className="flex-1 p-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-red-500"
                                />
                                <button
                                  type="submit"
                                  className="bg-red-600 text-white p-2 rounded-lg"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              </form>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleAddStep} className="flex gap-2 pt-4 border-t border-gray-100">
                    <input
                      placeholder="Nova Atividade Principal (ex: RETIRADA DO KD)"
                      value={newStepName}
                      onChange={e => setNewStepName(e.target.value)}
                      className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-all"
                    />
                    <button
                      type="submit"
                      disabled={!newStepName.trim()}
                      className="bg-gray-900 hover:bg-red-600 text-white p-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                    >
                      <Plus className="w-6 h-6" />
                    </button>
                  </form>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-3 text-sm text-blue-800">
                  <Info className="w-5 h-5 flex-shrink-0" />
                  <p>Clique em uma atividade para adicionar sub-passos detalhados, conforme mostrado na sua planilha de mapeamento.</p>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-gray-200 rounded-3xl bg-gray-50/50">
              <SettingsIcon className="w-16 h-16 text-gray-300 mb-4" />
              <h3 className="text-xl font-bold text-gray-900">Configuração de Processos</h3>
              <p className="text-gray-500 mt-2 max-w-xs">Selecione um processo à esquerda ou crie um novo para definir os passos de cronometragem.</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
