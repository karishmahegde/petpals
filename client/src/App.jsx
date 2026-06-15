import { Routes, Route } from "react-router-dom";

//what it does: The root component. Defines all the routes — which URL path renders which page component.
// Routes are uncommented as each sprint is implemented
function App() {
  return (
    <Routes>
      {/* Public */}
      {/* <Route path="/" element={<Landing />} /> */}
      {/* <Route path="/login" element={<Login />} /> */}
      {/* <Route path="/register" element={<Register />} /> */}
      {/* <Route path="/pets" element={<PetCatalog />} /> */}
      {/* <Route path="/pets/:id" element={<PetDetail />} /> */}

      {/* Adopter */}
      {/* <Route path="/adopter/*" element={<AdopterRoutes />} /> */}

      {/* Staff */}
      {/* <Route path="/staff/*" element={<StaffRoutes />} /> */}

      {/* Vet */}
      {/* <Route path="/vet/*" element={<VetRoutes />} /> */}

      {/* Volunteer */}
      {/* <Route path="/volunteer/*" element={<VolunteerRoutes />} /> */}

      {/* Donor */}
      {/* <Route path="/donor/*" element={<DonorRoutes />} /> */}

      {/* Admin */}
      {/* <Route path="/admin/*" element={<AdminRoutes />} /> */}

      <Route
        path="*"
        element={<div style={{ padding: 40 }}>PetPals — coming soon 🐾</div>}
      />
    </Routes>
  );
}

export default App;
