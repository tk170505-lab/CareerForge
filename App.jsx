import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import HomePage from './pages/HomePage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import SkillsAssessmentPage from './pages/SkillsAssessmentPage.jsx';
import LearningPage from './pages/LearningPage.jsx';
import CertificatesPage from './pages/CertificatesPage.jsx';
import JobsPage from './pages/JobsPage.jsx';
import ArchitecturePage from './pages/ArchitecturePage.jsx';

function AppShell() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  if (loading) {
    return (
      <div className="modal-backdrop">
        <div className="card">Loading CareerForge...</div>
      </div>
    );
  }

  if (!user) {
    return <HomePage />;
  }

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'dashboard' && <DashboardPage onNavigate={setActiveTab} />}
      {activeTab === 'skills' && <SkillsAssessmentPage onNavigate={setActiveTab} />}
      {activeTab === 'learning' && <LearningPage />}
      {activeTab === 'certificates' && <CertificatesPage />}
      {activeTab === 'jobs' && <JobsPage />}
      {activeTab === 'architecture' && <ArchitecturePage />}
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
