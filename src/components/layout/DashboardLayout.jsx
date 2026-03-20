import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import RoleAccessModal from '../RoleAccessModal';

const DashboardLayout = ({ children, activeTab, setActiveTab }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="flex h-screen bg-dash-bg overflow-hidden relative">
      <RoleAccessModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        openSettings={() => setIsModalOpen(true)}
      />
      
      <div className="flex flex-col flex-1 w-0 overflow-hidden relative">
        <Header toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
        
        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          {isSidebarOpen && (
            <div 
              className="md:hidden fixed inset-0 bg-slate-900/60 z-[60] backdrop-blur-sm transition-opacity"
              onClick={() => setIsSidebarOpen(false)}
            />
          )}
          <div className="py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
