export const setup = () => {
  // setting a fixed timezone for testing dates reliably
  process.env.TZ = "UTC";
  // and a fixed language, whose clock times are written on: 12 hours
  process.env.LC_ALL = "en_US.UTF-8";
};
