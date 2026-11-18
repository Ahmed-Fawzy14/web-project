const AUC_EMAIL = /^[^\s@]+@aucegypt\.edu$/i;
const ANY_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EGYPT_PHONE = /^(\+20|0)1[0125]\d{8}$/;

export const ID_FILE_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
export const MAX_ID_FILE_BYTES = 5 * 1024 * 1024;

export function phoneError(phone) {
  if (!phone.trim()) return 'Enter a contact phone number.';
  if (!EGYPT_PHONE.test(phone.replace(/[\s-]/g, ''))) return 'Enter an Egyptian mobile number, like 01005550123.';
  return null;
}

export function idFileError(file) {
  if (!file) return 'Upload a photo or scan of your ID.';
  if (!ID_FILE_TYPES.includes(file.type)) return 'Upload a JPG, PNG or PDF file.';
  if (file.size > MAX_ID_FILE_BYTES) return 'The file must be 5 MB or smaller.';
  return null;
}

export function emailError(email, { allowPersonal = false } = {}) {
  if (!email.trim()) return 'Enter your email address.';
  if (allowPersonal) return ANY_EMAIL.test(email.trim()) ? null : 'Enter a valid email address.';
  return AUC_EMAIL.test(email.trim()) ? null : 'Use your @aucegypt.edu email address.';
}

export function validateRegistration(values, { courier = false } = {}) {
  const errors = {};
  if (!values.name.trim()) errors.name = 'Enter your full name.';
  const personalAllowed = !courier && values.affiliation === 'alumni' && values.noAucEmail;
  const email = emailError(values.email, { allowPersonal: personalAllowed });
  if (email) errors.email = email;
  const phone = phoneError(values.phone);
  if (phone) errors.phone = phone;
  if (values.password.length < 8) errors.password = 'Use at least 8 characters.';
  if (values.confirm !== values.password) errors.confirm = 'The passwords do not match.';
  const file = idFileError(values.idFile);
  if (file) errors.idFile = file;
  return errors;
}

export function validateAddress(address) {
  const errors = {};
  if (!address.pin) errors.pin = 'Choose a location on the map.';
  if (!address.buildingId) errors.buildingId = 'Choose a building.';
  if (!address.floor.trim()) errors.floor = 'Enter the floor.';
  if (!address.room.trim()) errors.room = 'Enter a room or meeting point.';
  if (!address.directions.trim()) errors.directions = 'Add directions for your courier.';
  return errors;
}

export function feeError(value, { minimum = 1 } = {}) {
  const fee = Number(value);
  if (value === '' || !Number.isFinite(fee)) return 'Enter an amount in EGP.';
  if (fee < minimum) return `The amount must be at least EGP ${minimum}.`;
  if (fee > 500) return 'The amount must be EGP 500 or less.';
  return null;
}
