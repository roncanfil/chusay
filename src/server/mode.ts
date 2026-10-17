import 'server-only';

// DEMO_MODE=true: a new database starts with the sample trips and "Reset sample data" is available.
// Off by default, so a real household's data can't be wiped from the header.
export const demoMode = () => process.env.DEMO_MODE === 'true';
