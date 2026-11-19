import React from 'react';
import { SettingsProvider } from './SettingsContext';
import { CustomersProvider } from './CustomersContext';
import { SuppliersProvider } from './SuppliersContext';
import { PurchasesProvider } from './PurchasesContext';
import { DriversProvider } from './DriversContext';
import { PrintProvider } from './PrintContext';
import { LettersProvider } from './LettersContext';
import { ShippingOrdersProvider } from './ShippingOrdersContext';
import { MaterialsProvider } from './MaterialsContext';
import { EstimatesProvider } from './EstimatesContext';
import { WorkOrdersProvider } from './WorkOrdersContext';
import { InvoicesProvider } from './InvoicesContext';
import { AuthProvider } from './AuthContext';
import { AuditLogProvider } from './AuditLogContext';
import { HRProvider } from './HRContext';

export const AppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <AuthProvider>
      <AuditLogProvider>
        <PrintProvider>
          <SettingsProvider>
            <CustomersProvider>
              <SuppliersProvider>
                <PurchasesProvider>
                  <DriversProvider>
                    <LettersProvider>
                      <ShippingOrdersProvider>
                        <MaterialsProvider>
                          <EstimatesProvider>
                            <WorkOrdersProvider>
                              <InvoicesProvider>
                                <HRProvider>
                                  {children}
                                </HRProvider>
                              </InvoicesProvider>
                            </WorkOrdersProvider>
                          </EstimatesProvider>
                        </MaterialsProvider>
                      </ShippingOrdersProvider>
                    </LettersProvider>
                  </DriversProvider>
                </PurchasesProvider>
              </SuppliersProvider>
            </CustomersProvider>
          </SettingsProvider>
        </PrintProvider>
      </AuditLogProvider>
    </AuthProvider>
  );
};
