import * as React from 'react';
import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';

type UserRow = {
  username: string;
  email: string;
  createdAt: Date;
  Fichiers: {
    nom: string;
    nb: number;
  }[];
};

export type UserTableData = {
  username: string;
  email: string;
  createdAt: Date;
};

function createData(username : string, email : string, createdAt : Date): UserRow {
    return {
      username,
      email,
      createdAt,
      Fichiers: [
        {
          nom: 'devis',
          nb: 2,
        },
        {
          nom: 'factures fournisseurs',
          nb: 5,
        },
        {
          nom: 'Attestation SIRET',
          nb: 1,
        },
        {
          nom: 'Attestation de vigilance URSSAF',
          nb: 4,
        },
        {
          nom: 'Extrait Kbis',
          nb: 3,
        },
        {
          nom: 'RIB',
          nb: 0,
        },
      ],
    };
  }

  function Row(props: { row: UserRow }) {
    const { row } = props;
    const [open, setOpen] = React.useState(false);
  
    return (
      <React.Fragment>
        <TableRow sx={{ '& > *': { borderBottom: 'unset' } }}>
          <TableCell>
            <IconButton
              aria-label="expand row"
              size="small"
              onClick={() => setOpen(!open)}
            >
              {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
            </IconButton>
          </TableCell>
          <TableCell component="th" scope="row">
            {row.username}
          </TableCell>
          <TableCell align="right">{row.email}</TableCell>
          <TableCell align="right">{row.createdAt.toLocaleDateString('fr-FR')}</TableCell>
        </TableRow>
        <TableRow>
          <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
            <Collapse in={open} timeout="auto" unmountOnExit>
              <Box sx={{ margin: 1 }}>
                <Typography variant="h6" gutterBottom component="div">
                  Fichiers
                </Typography>
                <Table size="small" aria-label="purchases">
                  <TableHead>
                    <TableRow>
                      {row.Fichiers.map((fichier) => (
                        <TableCell key={fichier.nom}>{fichier.nom}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                   <TableRow>
                    {row.Fichiers.map((fichier) => (
                      <TableCell key={fichier.nom}>{fichier.nb}</TableCell>
                    ))}
                   </TableRow>
                  </TableBody>
                </Table>
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      </React.Fragment>
    );
  }

type UsersTableProps = {
  users: UserTableData[];
};

export default function CollapsibleTable({ users }: UsersTableProps) {
    const rows: UserRow[] = users.map((user) =>
      createData(user.username, user.email, user.createdAt)
    );

    return (
      <TableContainer component={Paper}>
        <Table aria-label="collapsible table">
          <TableHead>
            <TableRow>
              <TableCell />
              <TableCell>Nom d'utilisateur</TableCell>
              <TableCell align="right">Email</TableCell>
              <TableCell align="right">Date de creation</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <Row key={row.email} row={row} />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  }