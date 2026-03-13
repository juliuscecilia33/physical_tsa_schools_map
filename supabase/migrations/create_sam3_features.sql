CREATE TABLE sam3_features (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  geometry GEOGRAPHY(POLYGON, 4326) NOT NULL,
  sport_type TEXT NOT NULL,
  area_sqm DOUBLE PRECISION,
  rectangularity DOUBLE PRECISION,
  aspect_ratio DOUBLE PRECISION,
  compactness DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sam3_features_geometry ON sam3_features USING GIST (geometry);
CREATE INDEX idx_sam3_features_sport_type ON sam3_features (sport_type);
