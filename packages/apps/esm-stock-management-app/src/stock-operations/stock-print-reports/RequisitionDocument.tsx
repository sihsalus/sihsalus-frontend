import {
  CLOSE_PRINT_AFTER_PRINT,
  STOCK_OPERATION_PRINT_DISABLE_BALANCE_ON_HAND,
  STOCK_OPERATION_PRINT_DISABLE_COSTS,
} from '../../constants';
import { GetHeaderSection, GetPrintTemplate } from '../../core/print/PrintTemplate';
import { printDocument } from '../../core/print/printUtils';
import { formatDisplayDate } from '../../core/utils/datetimeUtils';
import { translateFromGlobal as t } from '../../core/utils/translationUtils';
import { type StockOperationPrintData } from './StockOperationReport';

export const FormatRequisitionDocument = async (data: StockOperationPrintData): Promise<string> => {
  const emptyRowCount: number = Math.max(0, 28 - (data?.items?.length ?? 0));
  const headerSection = await GetHeaderSection();
  return `
    <div>
        ${headerSection}
        <div class="heading text">
            <b>${t('requisitionAndIssueVoucher', 'Requisition and issue voucher')}</b>
        </div>
        <div class="heading-row text">
            <span>${t('healthUnitName', 'Name of health unit')}: </span>
            <b><span>${data?.organizationName ?? ''}</span></b>
        </div>
        <div class="heading-row text">
            <table style="width:99%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                    <td style="text-align: left;">
                        <span>${t('departmentSectionService', 'Department/section/service')}: </span>
                        <b><span>${data?.location ?? ''}</span></b>
                    </td>
                    <td style="text-align: right;">                    
                        <span>${t('date', 'Date')}: </span>
                        <b><span>${formatDisplayDate(data?.operationDate)}</span></b>
                    </td>
                </tr>
            </table>
        </div>
        <table class="table-data" border="0" cellspacing="0" cellpadding="0">
            <tr>
                <td colspan="4" valign="top" style='border:solid black 1.0pt;height:40pt'>
                    <div class='text'><b>${t('orderedByNameAndSignature', 'Ordered by (name and signature)')}:</b></div>
                    <p class='text' style='margin-top: 1pt;'>${data.orderedBy ?? '&nbsp;'}</p>
                </td>
                <td colspan="4" valign="top" style='border:solid black 1.0pt;border-left:none;height:40pt'>
                    <div class='text'><b>${t('authorizedByNameAndSignature', 'Authorized by (name and signature)')}:</b></div>
                    <p class='text' style='margin-top: 1pt;'>${data.authorizedBy ?? '&nbsp;'}</p>
                </td>
            </tr>            
            <tr>
                <th valign="middle" class="left"><b>${t('itemCodeNumber', 'Item code No.')}</b></th>
                <th valign="middle" class="left"><b>${t('itemDescription', 'Item description')}</b></th>
                <th valign="middle"><b>${t('balanceOnHand', 'Balance on hand')}</b></th>
                <th valign="middle"><b>${t('quantityRequired', 'Quantity required')}</b></th>
                <th valign="middle"><b>${t('quantityIssued', 'Quantity issued')}</b></th>
                <th valign="middle"><b>${t('unitCost', 'Unit cost')}</b></th>
                <th valign="middle"><b>${t('totalCost', 'Total cost')}</b></th>
            </tr>            
            ${
              data?.items
                ? data?.items
                    .map((p) => {
                      return `
                <tr class="data-row">
                    <td valign="middle">${p.itemCode ?? ''}</td>
                    <td valign="middle">${p.itemDescription ?? ''}</td>
                    <td valign="middle" class="center">${
                      STOCK_OPERATION_PRINT_DISABLE_BALANCE_ON_HAND || !p.balanceOnHand
                        ? ''
                        : `${p.balanceOnHand?.toLocaleString()}  ${p.balanceOnHandUoM ?? ''}`
                    }</td>
                    <td valign="middle" class="center">${p.quantityRequired?.toLocaleString() ?? ''} ${
                      p.quantityRequiredUoM ?? ''
                    }</td>
                    <td valign="middle" class="center">${p.quantityIssued?.toLocaleString() ?? ''} ${
                      p.quantityIssuedUoM ?? ''
                    }</td>
                    <td valign="middle" class="center">${
                      STOCK_OPERATION_PRINT_DISABLE_COSTS
                        ? ''
                        : `${p.unitCost?.toLocaleString() ?? ''}${p.unitCostUoM ? `/${p.unitCostUoM}` : ''}`
                    }</td>
                    <td valign="middle" class="center">${
                      STOCK_OPERATION_PRINT_DISABLE_COSTS ? '' : `${p.totalCost?.toLocaleString() ?? ''}`
                    }</td>
                </tr> 
                `;
                    })
                    .join('')
                : ''
            }
            ${
              emptyRowCount > 0
                ? Array(emptyRowCount)
                    .fill(0)
                    .map(
                      (p) => `
        <tr class="data-row">
            <td valign="middle">&nbsp;</td>
            <td valign="middle">&nbsp;</td>
            <td valign="middle" class="center">&nbsp;</td>
            <td valign="middle" class="center">&nbsp;</td>
            <td valign="middle" class="center">&nbsp;</td>
            <td valign="middle" class="center">&nbsp;</td>
            <td valign="middle" class="center">&nbsp;</td>
        </tr>`,
                    )
                    .join('')
                : ''
            }
            <tr class="footer-field">
                <td valign="middle" colspan="3">${t('issueDate', 'Issue date')}:</td>
                <td valign="middle" colspan="4">${t('receiptDate', 'Receipt date')}:</td>
            </tr>
            <tr class="footer-field">
                <td valign="middle" colspan="3">${t('receiverNameAndSignature', 'Receiver name and signature')}:</td>
                <td valign="middle" colspan="4">${t('issuerNameAndSignature', 'Issuer name and signature')}:</td>
            </tr>
        </table>
    </div>
    `;
};

export const PrintRequisitionStockOperation = async (data: StockOperationPrintData) => {
  const printData = await FormatRequisitionDocument(data);
  printDocument(GetPrintTemplate(printData, data?.documentTitle, true, CLOSE_PRINT_AFTER_PRINT));
};
