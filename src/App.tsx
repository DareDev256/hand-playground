import { useState, lazy, Suspense } from 'react';
import './App.css';

const ShapeTracer = lazy(() => import('./exercises/ShapeTracer'));
const CubeController = lazy(() => import('./exercises/CubeController'));
const PianoKeys = lazy(() => import('./exercises/PianoKeys'));
const ParticleMagnet = lazy(() => import('./exercises/ParticleMagnet'));
const SwipeNavigator = lazy(() => import('./exercises/SwipeNavigator'));
const GrabAndToss = lazy(() => import('./exercises/GrabAndToss'));
const DepthControl = lazy(() => import('./exercises/DepthControl'));

const TABS = [
  { id: 'shape', label: 'Shape Tracer', icon: '△', component: ShapeTracer },
  { id: 'cube', label: '3D Cube', icon: '⬡', component: CubeController },
  { id: 'piano', label: 'Piano Keys', icon: '♫', component: PianoKeys },
  { id: 'particles', label: 'Particles', icon: '◎', component: ParticleMagnet },
  { id: 'swipe', label: 'Swipe Nav', icon: '⇄', component: SwipeNavigator },
  { id: 'grab', label: 'Grab & Toss', icon: '✊', component: GrabAndToss },
  { id: 'depth', label: 'Depth', icon: '◈', component: DepthControl },
] as const;

export default function App() {
  const [activeTab, setActiveTab] = useState(TABS[0].id);
  const ActiveComponent = TABS.find((t) => t.id === activeTab)!.component;

  return (
    <div className="app">
      <header className="header">
        <h1 className="title">Hand Playground</h1>
        <p className="subtitle">Hand-tracking interaction experiments with MediaPipe</p>
        <nav className="tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
            </button>
          ))}
        </nav>
      </header>
      <main className="canvas-area">
        <Suspense fallback={<div className="loading">Loading exercise...</div>}>
          <ActiveComponent key={activeTab} />
        </Suspense>
      </main>
    </div>
  );
}
