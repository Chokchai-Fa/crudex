import { Link } from '@tanstack/react-router';
import { BookOpen } from 'lucide-react';
import { signOutDemo } from '@/features/workspace/demo-session';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { rooms } from './fraction-set';

export function RoomNavigation({
  room,
  onRoomChange,
  gradebook = false,
}: {
  room: string;
  onRoomChange: (room: string) => void;
  gradebook?: boolean;
}) {
  return (
    <nav
      aria-label="พื้นที่ครู"
      className="grid grid-cols-[1fr_auto] items-center gap-x-2 px-2 lg:flex lg:flex-col lg:items-stretch lg:gap-3 lg:border-e lg:p-5 print:hidden"
    >
      <Link
        to="/sign-in"
        aria-label="Crudex · เลือกบทบาท"
        className="inline-flex min-h-11 w-fit items-center rounded-lg focus-visible:outline-2 focus-visible:outline-ring"
      >
        <img
          src="/roles/brand.png"
          alt=""
          width="122"
          height="27"
          className="w-28 rounded dark:bg-white dark:p-1 lg:w-[122px]"
        />
      </Link>
      <p className="col-start-1 row-start-2 text-sm font-semibold">
        ครูผู้สอน <span className="text-muted-foreground font-normal">· บัญชีตัวอย่าง</span>
      </p>
      <Link
        to="/sign-in"
        className="col-start-2 row-start-1 inline-flex min-h-11 items-center justify-end text-sm underline lg:order-last lg:justify-start"
      >
        สลับบทบาท
      </Link>
      <Button variant="link" className="justify-start px-0 lg:order-last" onClick={signOutDemo}>
        ออกจากระบบ
      </Button>
      <div className="col-start-1 flex items-center gap-2 lg:flex-col lg:items-stretch">
        <Label htmlFor="room">ห้อง</Label>
        <NativeSelect id="room" value={room} onChange={(event) => onRoomChange(event.target.value)}>
          {rooms.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </NativeSelect>
      </div>
      {gradebook && (
        <Button asChild variant="link" className="justify-end px-0 lg:justify-start">
          <Link
            to="/teacher"
            onClick={() => sessionStorage.setItem('crudex.demo.teacher.room', room)}
          >
            กลับหน้าครู
          </Link>
        </Button>
      )}
      <Button
        asChild
        variant={gradebook ? 'default' : 'outline'}
        className={gradebook ? 'hidden lg:inline-flex' : undefined}
      >
        <Link to="/gradebook" search={{ room }}>
          <BookOpen aria-hidden="true" />
          สมุดคะแนน
        </Link>
      </Button>
      <Button asChild variant="link" className="col-span-2 justify-start px-0">
        <Link to="/memory" search={{ room }}>
          ความจำของห้อง {room}
        </Link>
      </Button>
    </nav>
  );
}
