const zipcodes = require("zipcodes");

const resolveCoordsFromPostalCode = (postalCode) => {
  const result = zipcodes.lookup(postalCode);
  if (!result) return null;
  return { lat: result.latitude, lng: result.longitude };
};

module.exports = { resolveCoordsFromPostalCode };
