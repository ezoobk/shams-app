exports.default = async function(configuration) {
  // Do nothing to skip code signing
  console.log('Skipping code signing for: ' + configuration.path);
};
