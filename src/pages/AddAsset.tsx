import { useState } from 'react';
import { useFixtureStore } from '@/store/fixtureStore';
import type { FixtureCategory } from '@/store/fixtureStore';
import { Camera, ScanLine, CheckCircle2, Building2, ChevronLeft, ChevronRight, ImagePlus, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { StarRating } from '@/components/StarRating';

export default function AddAsset() {
  const { buildings, addBuilding, addFixture } = useFixtureStore();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  // Step 1
  const [selectedBuildingId, setSelectedBuildingId] = useState('');
  const [newBuildingName, setNewBuildingName] = useState('');
  const [newBuildingFloors, setNewBuildingFloors] = useState('');
  const [floor, setFloor] = useState('');

  // Step 2 - photos
  const [photo, setPhoto] = useState<string | null>(null);
  const [platePhoto, setPlatePhoto] = useState<string | null>(null);

  // Step 3 - scan results
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [filterType, setFilterType] = useState('');
  const [scanned, setScanned] = useState(false);

  // Step 4
  const [roomNumber, setRoomNumber] = useState('');
  const [installationDate, setInstallationDate] = useState('');
  const [category, setCategory] = useState<FixtureCategory>('Public');
  const [pressure, setPressure] = useState(3);
  const [cleanliness, setCleanliness] = useState(3);

  const selectedBuilding = buildings.find((b) => b.id === selectedBuildingId);

  function handleCreateBuilding() {
    if (!newBuildingName || !newBuildingFloors) return;
    const id = `b${Date.now()}`;
    addBuilding({ id, name: newBuildingName, floors: parseInt(newBuildingFloors) });
    setSelectedBuildingId(id);
    setNewBuildingName('');
    setNewBuildingFloors('');
  }

  function handlePhotoUpload(setter: (v: string) => void) {
    setter(`https://placehold.co/400x300/1a365d/ffffff?text=Fixture+Photo`);
  }

  function handleScan() {
    setTimeout(() => {
      setBrand('Elkay');
      setModel('EZH2O Liv');
      setSerialNumber(`SN-${Math.random().toString(36).substring(2, 8).toUpperCase()}`);
      setFilterType('WaterSentry Plus');
      setScanned(true);
    }, 1200);
  }

  function handleSubmit() {
    const building = buildings.find((b) => b.id === selectedBuildingId);
    if (!building) return;
    addFixture({
      id: `f${Date.now()}`,
      buildingId: selectedBuildingId,
      buildingName: building.name,
      floor: parseInt(floor),
      roomNumber,
      brand,
      model,
      serialNumber,
      photoURL: photo || '',
      modelPlatePhotoURL: platePhoto || '',
      lastMaintenanceDate: installationDate || new Date().toISOString().split('T')[0],
      filterType,
      installationDate: installationDate || new Date().toISOString().split('T')[0],
      category,
      qualityRating: { pressure, cleanliness },
      posX: Math.floor(Math.random() * 60 + 20),
      posY: Math.floor(Math.random() * 60 + 20),
    });
    navigate('/');
  }

  const canProceed: Record<number, boolean> = {
    1: !!selectedBuildingId && !!floor,
    2: true,
    3: !!brand && !!model,
    4: !!roomNumber,
  };

  return (
    <div className="px-4 pt-6">
      <h1 className="text-xl font-bold text-foreground">Onboard New Fixture</h1>

      {/* Step indicator */}
      <div className="mt-4 flex gap-2">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= step ? 'bg-accent' : 'bg-secondary'}`} />
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Step {step} of 4</p>

      {/* Step 1: Building & Floor */}
      {step === 1 && (
        <div className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">Select Building</label>
            <select value={selectedBuildingId} onChange={(e) => setSelectedBuildingId(e.target.value)} className="mt-1 w-full rounded-lg border bg-card px-3 py-2.5 text-sm text-foreground">
              <option value="">Choose a building...</option>
              {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="rounded-lg border bg-secondary/50 p-3">
            <p className="text-xs font-medium text-foreground mb-2">Or create new building</p>
            <input value={newBuildingName} onChange={(e) => setNewBuildingName(e.target.value)} placeholder="Building name" className="w-full rounded-lg border bg-card px-3 py-2 text-sm text-foreground mb-2" />
            <input value={newBuildingFloors} onChange={(e) => setNewBuildingFloors(e.target.value)} placeholder="Number of floors" type="number" className="w-full rounded-lg border bg-card px-3 py-2 text-sm text-foreground mb-2" />
            <button onClick={handleCreateBuilding} className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground">
              <Building2 className="inline h-3 w-3 mr-1" /> Create Building
            </button>
          </div>
          {selectedBuilding && (
            <div>
              <label className="text-sm font-medium text-foreground">Floor</label>
              <select value={floor} onChange={(e) => setFloor(e.target.value)} className="mt-1 w-full rounded-lg border bg-card px-3 py-2.5 text-sm text-foreground">
                <option value="">Select floor...</option>
                {Array.from({ length: selectedBuilding.floors }, (_, i) => <option key={i + 1} value={i + 1}>Floor {i + 1}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Photos */}
      {step === 2 && (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">Take photos of the fixture</p>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => handlePhotoUpload(setPhoto)} className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-muted-foreground hover:border-accent hover:text-accent transition-colors">
              {photo ? <img src={photo} alt="Fixture" className="h-20 w-full rounded-lg object-cover" /> : <><Camera className="h-8 w-8" /><span className="text-xs font-medium">General Photo</span></>}
            </button>
            <button onClick={() => handlePhotoUpload(setPlatePhoto)} className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-muted-foreground hover:border-accent hover:text-accent transition-colors">
              {platePhoto ? <img src={platePhoto} alt="Model Plate" className="h-20 w-full rounded-lg object-cover" /> : <><ImagePlus className="h-8 w-8" /><span className="text-xs font-medium">Model Plate</span></>}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Scan */}
      {step === 3 && (
        <div className="mt-4 space-y-4">
          {!scanned ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <ScanLine className="h-12 w-12 text-accent animate-pulse" />
              <p className="text-sm text-muted-foreground text-center">Use AI Vision to extract fixture details from the model plate photo</p>
              <button onClick={handleScan} className="rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground">Scan Model Plate</button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-status-good mb-2">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm font-medium">Scan Complete</span>
              </div>
              {[
                { label: 'Brand', value: brand, setter: setBrand },
                { label: 'Model', value: model, setter: setModel },
                { label: 'Serial Number', value: serialNumber, setter: setSerialNumber },
                { label: 'Filter Type', value: filterType, setter: setFilterType },
              ].map(({ label, value, setter }) => (
                <div key={label}>
                  <label className="text-xs font-medium text-muted-foreground">{label}</label>
                  <input value={value} onChange={(e) => setter(e.target.value)} className="mt-1 w-full rounded-lg border bg-card px-3 py-2 text-sm text-foreground" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 4: Manual details + Categorization + Quality */}
      {step === 4 && (
        <div className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">Room Number</label>
            <input value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} placeholder="e.g. 205" className="mt-1 w-full rounded-lg border bg-card px-3 py-2.5 text-sm text-foreground" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Installation Date</label>
            <input value={installationDate} onChange={(e) => setInstallationDate(e.target.value)} type="date" className="mt-1 w-full rounded-lg border bg-card px-3 py-2.5 text-sm text-foreground" />
          </div>

          {/* Category */}
          <div>
            <label className="text-sm font-medium text-foreground">Category</label>
            <div className="flex gap-2 mt-1.5">
              {(['Public', 'Private'] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition-colors ${
                    category === c ? 'bg-accent text-accent-foreground' : 'bg-secondary text-secondary-foreground'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Quality Rating */}
          <div>
            <label className="text-sm font-medium text-foreground">Water Pressure</label>
            <StarRating value={pressure} onChange={setPressure} />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Cleanliness</label>
            <StarRating value={cleanliness} onChange={setCleanliness} />
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="mt-6 flex gap-3">
        {step > 1 && (
          <button onClick={() => setStep(step - 1)} className="flex items-center gap-1 rounded-lg border px-4 py-2.5 text-sm font-medium text-foreground">
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
        )}
        <div className="flex-1" />
        {step < 4 ? (
          <button onClick={() => setStep(step + 1)} disabled={!canProceed[step]} className="flex items-center gap-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground disabled:opacity-40">
            Next <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={!canProceed[4]} className="flex items-center gap-1 rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-accent-foreground disabled:opacity-40">
            <CheckCircle2 className="h-4 w-4" /> Save Fixture
          </button>
        )}
      </div>
    </div>
  );
}
