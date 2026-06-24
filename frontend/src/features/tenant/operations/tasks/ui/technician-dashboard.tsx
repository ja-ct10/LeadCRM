'use client';

import React, { useState, useRef } from 'react';
import { useData } from '@/store/DataContext';
import { useAuth } from '@/store/AuthContext';
import { ServiceOrder } from '@/store/types';
import { MapPin, Calendar, CheckCircle2, Camera, X, Check } from 'lucide-react';

export default function TechnicianDashboard() {
  const { serviceOrders, updateServiceOrder } = useData();
  const { user } = useAuth();
  
  // For demo, we just show all orders or filter by some logic. 
  // In a real app, we'd filter by assignedTechnicianId === user.id
  const myOrders = serviceOrders;

  const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'photos' | 'signature'>('details');
  const [signatureData, setSignatureData] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const handleOrderClick = (order: ServiceOrder) => {
    setSelectedOrder(order);
    setActiveTab('details');
    setSignatureData(order.signature || null);
  };

  const closeOrder = () => {
    setSelectedOrder(null);
    setSignatureData(null);
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureData(null);
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedOrder) return;
    const dataUrl = canvas.toDataURL();
    setSignatureData(dataUrl);
    updateServiceOrder(selectedOrder.id, { signature: dataUrl });
  };

  const handlePhotoUpload = (type: 'before' | 'after') => {
    // Simulate photo upload
    if (!selectedOrder) return;
    const newPhotoUrl = 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&q=80&w=400';
    const currentPhotos = selectedOrder.photos[type] || [];
    
    updateServiceOrder(selectedOrder.id, {
      photos: {
        ...selectedOrder.photos,
        [type]: [...currentPhotos, newPhotoUrl]
      }
    });

    setSelectedOrder({
      ...selectedOrder,
      photos: {
        ...selectedOrder.photos,
        [type]: [...currentPhotos, newPhotoUrl]
      }
    });
  };

  const completeJob = () => {
    if (!selectedOrder) return;
    updateServiceOrder(selectedOrder.id, { status: 'completed' });
    setSelectedOrder({ ...selectedOrder, status: 'completed' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'in-progress': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default: return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto pb-24">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-display">My Jobs</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm">Today's assigned service orders</p>
      </div>

      <div className="space-y-4">
        {myOrders.map(order => (
          <div 
            key={order.id} 
            onClick={() => handleOrderClick(order)}
            className="bg-white dark:bg-slate-950 border border-white/5 rounded-2xl p-4 active:scale-[0.98] transition-transform cursor-pointer"
          >
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{order.title}</h3>
              <span className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(order.status)} uppercase font-bold tracking-wider`}>
                {order.status}
              </span>
            </div>
            <div className="space-y-2 text-sm text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <MapPin size={14} className="text-slate-500" />
                <span className="truncate">{order.address}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-slate-500" />
                <span>{new Date(order.scheduledDate).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        ))}
        {myOrders.length === 0 && (
          <div className="text-center py-12 bg-white dark:bg-slate-950 rounded-2xl border border-white/5">
            <CheckCircle2 size={48} className="mx-auto text-slate-600 mb-4" />
            <p className="text-slate-500 dark:text-slate-400">No jobs assigned for today.</p>
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex flex-col bg-gray-50 dark:bg-white dark:bg-slate-950">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white dark:bg-slate-950">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate pr-4">{selectedOrder.title}</h2>
            <button onClick={closeOrder} className="p-2 bg-gray-100 dark:bg-white/5 rounded-full text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
              <X size={20} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-white/5 bg-white dark:bg-slate-950">
            <button 
              onClick={() => setActiveTab('details')}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'details' ? 'border-[#0A6EFF] text-[#0A6EFF]' : 'border-transparent text-slate-500 dark:text-slate-400'}`}
            >
              Details
            </button>
            <button 
              onClick={() => setActiveTab('photos')}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'photos' ? 'border-[#0A6EFF] text-[#0A6EFF]' : 'border-transparent text-slate-500 dark:text-slate-400'}`}
            >
              Photos
            </button>
            <button 
              onClick={() => setActiveTab('signature')}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'signature' ? 'border-[#0A6EFF] text-[#0A6EFF]' : 'border-transparent text-slate-500 dark:text-slate-400'}`}
            >
              Sign-off
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {activeTab === 'details' && (
              <div className="space-y-6">
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Client</h4>
                  <p className="text-slate-900 dark:text-white font-medium">{selectedOrder.clientName}</p>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Location</h4>
                  <div className="flex items-start gap-2 bg-gray-100 dark:bg-white/5 p-3 rounded-xl">
                    <MapPin size={18} className="text-[#0A6EFF] shrink-0 mt-0.5" />
                    <p className="text-slate-700 dark:text-slate-300 text-sm">{selectedOrder.address}</p>
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Instructions</h4>
                  <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed bg-gray-100 dark:bg-white/5 p-3 rounded-xl">
                    {selectedOrder.description}
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'photos' && (
              <div className="space-y-8">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Before Work</h4>
                    <button 
                      onClick={() => handlePhotoUpload('before')}
                      className="flex items-center gap-2 text-xs bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 text-slate-900 dark:text-white px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Camera size={14} /> Add Photo
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {selectedOrder.photos?.before?.map((url, idx) => (
                      <div key={idx} className="aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10">
                        <img src={url} alt="Before" className="w-full h-full object-cover" />
                      </div>
                    ))}
                    {(!selectedOrder.photos?.before || selectedOrder.photos.before.length === 0) && (
                      <div className="col-span-2 py-8 text-center border border-dashed border-gray-200 dark:border-white/10 rounded-xl text-slate-500 text-sm">
                        No photos uploaded yet.
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white">After Work</h4>
                    <button 
                      onClick={() => handlePhotoUpload('after')}
                      className="flex items-center gap-2 text-xs bg-[#0A6EFF] hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Camera size={14} /> Add Photo
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {selectedOrder.photos?.after?.map((url, idx) => (
                      <div key={idx} className="aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10">
                        <img src={url} alt="After" className="w-full h-full object-cover" />
                      </div>
                    ))}
                    {(!selectedOrder.photos?.after || selectedOrder.photos.after.length === 0) && (
                      <div className="col-span-2 py-8 text-center border border-dashed border-gray-200 dark:border-white/10 rounded-xl text-slate-500 text-sm">
                        No photos uploaded yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'signature' && (
              <div className="space-y-6">
                <div className="bg-gray-100 dark:bg-white/5 p-4 rounded-xl border border-gray-200 dark:border-white/10">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Client Sign-off</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">I confirm that the work described has been completed to my satisfaction.</p>
                  
                  {signatureData ? (
                    <div className="bg-white rounded-xl p-2 mb-4">
                      <img src={signatureData} alt="Client Signature" className="w-full h-32 object-contain" />
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl mb-4 overflow-hidden touch-none">
                      <canvas
                        ref={canvasRef}
                        width={300}
                        height={150}
                        className="w-full h-32 cursor-crosshair"
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseOut={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                      />
                    </div>
                  )}

                  {!signatureData ? (
                    <div className="flex gap-3">
                      <button onClick={clearSignature} className="flex-1 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-gray-200 dark:bg-white/10 rounded-lg">Clear</button>
                      <button onClick={saveSignature} className="flex-1 py-2 text-sm font-medium text-slate-900 dark:text-white bg-[#0A6EFF] rounded-lg">Save Signature</button>
                    </div>
                  ) : (
                    <button onClick={clearSignature} className="w-full py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-gray-200 dark:bg-white/10 rounded-lg">Redo Signature</button>
                  )}
                </div>

                {selectedOrder.status !== 'completed' && (
                  <button 
                    onClick={completeJob}
                    disabled={!signatureData}
                    className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${signatureData ? 'bg-green-500 hover:bg-green-600 text-white shadow-[0_0_20px_rgba(34,197,94,0.3)]' : 'bg-gray-100 dark:bg-white/5 text-slate-500 cursor-not-allowed'}`}
                  >
                    <CheckCircle2 size={20} /> Complete Job
                  </button>
                )}
                
                {selectedOrder.status === 'completed' && (
                  <div className="w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 bg-green-500/20 text-green-400 border border-green-500/30">
                    <Check size={20} /> Job Completed
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
