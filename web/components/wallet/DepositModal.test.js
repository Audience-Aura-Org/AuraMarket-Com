import {describe,it,expect,vi,beforeEach,afterEach} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
const mocks=vi.hoisted(()=>({init:vi.fn(),poll:vi.fn(),stop:vi.fn(),events:{}}));
vi.mock('@/services/paymentProvider',()=>({initiateSmartCameroonCollection:mocks.init,initiateCollection:mocks.init,pollTransactionStatus:mocks.poll,recheckTransaction:vi.fn()}));
vi.mock('@/services/socket',()=>({default:{on:(name,cb)=>{mocks.events[name]=cb},off:(name)=>{delete mocks.events[name]}}}));
vi.mock('@/hooks/useAuth',()=>({useAuthStore:selector=>selector({setWalletBalance:vi.fn()})}));
vi.mock('@/services/api',()=>({default:{get:vi.fn()}}));
import DepositModal from './DepositModal';
beforeEach(()=>{vi.clearAllMocks();mocks.events={};mocks.poll.mockReturnValue(mocks.stop)});
afterEach(cleanup);
const start=()=>{fireEvent.change(screen.getByRole('spinbutton'),{target:{value:'1000'}});fireEvent.click(screen.getByRole('button',{name:'Deposit funds',exact:true}))};
it('shows insufficient mobile money immediately as a failure instead of a timeout, with no success callback',async()=>{
 const success=vi.fn();mocks.init.mockRejectedValue({response:{status:422,data:{status:'FAILED',code:'INSUFFICIENT_FUNDS',message:'Your mobile-money account has insufficient funds. Top up and try again.'}}});
 render(<DepositModal open userPhone='+237670000001' onSuccess={success}/>);start();
 await screen.findByRole('heading',{name:'Insufficient funds',exact:true});expect(screen.getByRole('alert').textContent).toContain('mobile-money');expect(success).not.toHaveBeenCalled();expect(mocks.poll).not.toHaveBeenCalled();
});
it('stops polling on a matching live failure and ignores another deposit reference',async()=>{
 const success=vi.fn();mocks.init.mockResolvedValue({success:true,gateway:'pawapay',data:{reference:'deposit-1'}});
 render(<DepositModal open userPhone='+237670000001' onSuccess={success}/>);start();await waitFor(()=>expect(mocks.events.payment_status).toBeTruthy(),{timeout:3000});
 mocks.events.payment_status({gateway:'pawapay',reference:'another',status:'FAILED',reason:'insufficient funds'});expect(mocks.stop).not.toHaveBeenCalled();
 mocks.events.payment_status({gateway:'pawapay',reference:'deposit-1',status:'FAILED',reason:'Your mobile-money account has insufficient funds.'});
 await screen.findByRole('heading',{name:'Insufficient funds',exact:true});expect(mocks.stop).toHaveBeenCalledOnce();expect(success).not.toHaveBeenCalled();
});
