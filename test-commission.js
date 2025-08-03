import { calculateCommissionAndPayment, calculateMultipleServicesCommission } from './utils/commissionCalculator.js';

console.log('=== Testing Commission Calculator ===\n');

// Test single service commission calculation
console.log('1. Single Service Commission Test:');
const singleServiceResult = calculateCommissionAndPayment(1000, 200);
console.log('Service Amount: ₹1000');
console.log('Distance Charge: ₹200');
console.log('Admin Commission: ₹' + singleServiceResult.adminCommission);
console.log('Worker Payment: ₹' + singleServiceResult.workerPayment);
console.log('Total Amount: ₹' + singleServiceResult.totalAmount);
console.log('Expected: Admin gets ₹200 (20% of ₹1000), Worker gets ₹800\n');

// Test multiple services commission calculation
console.log('2. Multiple Services Commission Test:');
const multipleServices = [
  { serviceType: 'plumber', serviceTitle: 'Pipe Repair', amount: 500, quantity: 1 },
  { serviceType: 'electrician', serviceTitle: 'Switch Repair', amount: 300, quantity: 1 },
  { serviceType: 'carpenter', serviceTitle: 'Door Repair', amount: 800, quantity: 2 }
];
const distanceCharge = 150;

const multipleServicesResult = calculateMultipleServicesCommission(multipleServices, distanceCharge);
console.log('Services:');
multipleServices.forEach((service, index) => {
  console.log(`  ${index + 1}. ${service.serviceTitle}: ₹${service.amount} x ${service.quantity} = ₹${service.amount * service.quantity}`);
});
console.log('Distance Charge: ₹' + distanceCharge);
console.log('Total Service Amount: ₹' + multipleServicesResult.totalServiceAmount);
console.log('Total Admin Commission: ₹' + multipleServicesResult.totalAdminCommission);
console.log('Total Worker Payment: ₹' + multipleServicesResult.totalWorkerPayment);
console.log('Total Amount: ₹' + multipleServicesResult.totalAmount);

console.log('\nBreakdown by service:');
multipleServicesResult.servicesBreakdown.forEach((service, index) => {
  console.log(`  ${index + 1}. ${service.serviceTitle}:`);
  console.log(`     Service Amount: ₹${service.serviceAmount}`);
  console.log(`     Admin Commission: ₹${service.adminCommission}`);
  console.log(`     Worker Payment: ₹${service.workerPayment}`);
});

console.log('\n=== Test Completed ==='); 